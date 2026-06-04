import { System } from '../../types';
import type {
  AnyComponent,
  AnimationActionName,
  AnimationControllerComponent,
  AnimationDirection,
  AnimationLayerConflictPolicy,
  AnimationLayerState,
  Entity,
} from '../../types';
import type {
  AnimationInterpolation,
  AnimationKeyEvent,
  AnimationKeyframe,
  AnimationKeyValue,
  AnimationLabel,
  AnimationTrack,
  AnimationsComponent,
} from '../components/Animations';
import { enqueueSignalEvent } from '../signalRuntime';

const DEFAULT_FPS = 60;
const BEZIER_REGEX =
  /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/i;

interface EntityAnimationRuntime {
  activeLabelByLayer: Map<string, string>;
  relativeBaseByLayer: Map<string, Map<string, number>>;
  firedEventKeysByLayer: Map<string, Set<string>>;
  eventLastFiredAtByLayer: Map<string, Map<string, number>>;
}

interface ActiveLayerSnapshot {
  id: string;
  order: number;
  priority: number;
  weight: number;
  writeMask: string[];
  blockMask: string[];
  state: AnimationLayerState;
}

interface LayerTrackWrite {
  prop: string;
  value: AnimationKeyValue;
  layerId: string;
  order: number;
  priority: number;
  weight: number;
}

interface LayerTriggeredEvent {
  signal: string;
  payload: Record<string, unknown>;
}

export class EcsAnimationSystem extends System {
  private readonly runtimeByEntity = new Map<string, EntityAnimationRuntime>();

  update(entities: Entity[], deltaTime: number): void {
    const frameDelta = Math.max(0, deltaTime) * DEFAULT_FPS;
    const activeEntityIds = new Set<string>();

    for (const entity of entities) {
      const entityId = String(entity.id);
      activeEntityIds.add(entityId);
      const animations = entity.components.get('Animations') as AnimationsComponent | undefined;
      const controller = entity.components.get('AnimationController') as
        | AnimationControllerComponent
        | undefined;
      if (!animations || !controller) {
        continue;
      }

      const pendingActions = consumeAnimationControllerActions(controller);
      for (const pending of pendingActions) {
        applyAnimationControllerAction(controller, pending.action, pending.args);
      }

      const activeLayers = collectActiveLayers(controller);
      if (activeLayers.length === 0) {
        continue;
      }

      const runtime = this.getOrCreateRuntime(entityId);
      const { writes, events } = collectLayerWrites(entity, animations, activeLayers, frameDelta, runtime);
      applyLayeredWrites(entity, writes, controller.layerConflictPolicy ?? 'byMask');
      for (const event of events) {
        enqueueSignalEvent({
          id: event.signal,
          payload: event.payload,
          scopeSelfId: entityId,
        });
      }
      if (controller.mode !== 'layered' && activeLayers[0]) {
        const state = activeLayers[0].state;
        controller.playing = state.playing;
        controller.currentLabel = state.currentLabel;
        controller.localFrame = state.localFrame;
        controller.speedScale = state.speedScale;
        controller.direction = state.direction;
        controller.loopOverride = state.loopOverride;
        controller.fallbackLabel = state.fallbackLabel;
      }
    }

    for (const entityId of [...this.runtimeByEntity.keys()]) {
      if (!activeEntityIds.has(entityId)) {
        this.runtimeByEntity.delete(entityId);
      }
    }
  }

  private getOrCreateRuntime(entityId: string): EntityAnimationRuntime {
    const existing = this.runtimeByEntity.get(entityId);
    if (existing) {
      return existing;
    }

    const runtime: EntityAnimationRuntime = {
      activeLabelByLayer: new Map(),
      relativeBaseByLayer: new Map(),
      firedEventKeysByLayer: new Map(),
      eventLastFiredAtByLayer: new Map(),
    };
    this.runtimeByEntity.set(entityId, runtime);
    return runtime;
  }
}

function resolveLabelForState(
  animations: AnimationsComponent,
  state: AnimationLayerState,
): AnimationLabel | undefined {
  if (!animations.labels || Object.keys(animations.labels).length === 0) {
    return undefined;
  }

  const fallbackLabelName = animations.defaultLabel ?? Object.keys(animations.labels)[0];
  const requestedLabel = state.currentLabel ?? fallbackLabelName;
  const label = animations.labels[requestedLabel];
  if (label) {
    state.currentLabel = requestedLabel;
    return label;
  }

  if (!fallbackLabelName) {
    return undefined;
  }
  state.currentLabel = fallbackLabelName;
  return animations.labels[fallbackLabelName];
}

function collectLayerWrites(
  entity: Entity,
  animations: AnimationsComponent,
  layers: ActiveLayerSnapshot[],
  frameDelta: number,
  runtime: EntityAnimationRuntime,
): { writes: LayerTrackWrite[]; events: LayerTriggeredEvent[] } {
  const writes: LayerTrackWrite[] = [];
  const events: LayerTriggeredEvent[] = [];
  for (const layer of layers) {
    const label = resolveLabelForState(animations, layer.state);
    if (!label) {
      continue;
    }

    const activeLabelKey = runtime.activeLabelByLayer.get(layer.id);
    if (activeLabelKey !== label.name) {
      runtime.activeLabelByLayer.set(layer.id, label.name);
      runtime.relativeBaseByLayer.set(layer.id, captureRelativeBaselines(entity, label));
      runtime.firedEventKeysByLayer.set(layer.id, new Set());
      runtime.eventLastFiredAtByLayer.set(layer.id, new Map());
    }

    const previousFrame = layer.state.localFrame;
    const loop = layer.state.loopOverride ?? label.loop;
    advanceLayerState(layer.state, label, frameDelta);
    const currentFrame = layer.state.localFrame;
    const wrapped = didWrapAround(previousFrame, currentFrame, layer.state.direction, loop);

    const relativeBaseByTrack = runtime.relativeBaseByLayer.get(layer.id) ?? new Map<string, number>();
    const firedOnce = runtime.firedEventKeysByLayer.get(layer.id) ?? new Set<string>();
    const eventLastFiredAt = runtime.eventLastFiredAtByLayer.get(layer.id) ?? new Map<string, number>();
    runtime.firedEventKeysByLayer.set(layer.id, firedOnce);
    runtime.eventLastFiredAtByLayer.set(layer.id, eventLastFiredAt);

    for (const track of label.tracks) {
      if (!isTrackAllowedForLayer(track.prop, layer.writeMask, layer.blockMask)) {
        continue;
      }

      collectTrackEvents(
        events,
        entity,
        track,
        previousFrame,
        currentFrame,
        wrapped,
        layer.state.direction,
        label,
        firedOnce,
        eventLastFiredAt,
      );

      const value = sampleTrack(track, layer.state.localFrame);
      if (value === undefined) {
        continue;
      }
      let finalValue = value;
      if (track.valueMode === 'relative' && typeof value === 'number') {
        finalValue = (relativeBaseByTrack.get(track.prop) ?? 0) + value;
      }
      writes.push({
        prop: track.prop,
        value: finalValue,
        layerId: layer.id,
        order: layer.order,
        priority: layer.priority,
        weight: layer.weight,
      });
    }
  }
  return { writes, events };
}

function collectTrackEvents(
  outEvents: LayerTriggeredEvent[],
  entity: Entity,
  track: AnimationTrack,
  previousFrame: number,
  currentFrame: number,
  wrapped: boolean,
  direction: AnimationDirection,
  label: AnimationLabel,
  firedOnce: Set<string>,
  eventLastFiredAt: Map<string, number>,
): void {
  const now = Date.now();
  for (let keyIndex = 0; keyIndex < track.keys.length; keyIndex++) {
    const key = track.keys[keyIndex];
    if (!key.events || key.events.length === 0) continue;
    for (let eventIndex = 0; eventIndex < key.events.length; eventIndex++) {
      const event = key.events[eventIndex];
      if (!shouldEvaluateDirection(event.direction, direction)) continue;
      if (!shouldTriggerForPhase(event, previousFrame, currentFrame, key.frame, wrapped, direction)) continue;

      const eventKey = `${track.prop}|${label.name}|${keyIndex}|${eventIndex}`;
      if (event.once && firedOnce.has(eventKey)) continue;
      const lastFiredAt = eventLastFiredAt.get(eventKey) ?? 0;
      if (event.cooldownMs > 0 && now - lastFiredAt < event.cooldownMs) continue;

      eventLastFiredAt.set(eventKey, now);
      if (event.once) firedOnce.add(eventKey);
      outEvents.push({
        signal: event.signal,
        payload: buildAnimationEventPayload(entity, track, label, key, event, currentFrame),
      });
    }
  }
}

function shouldEvaluateDirection(
  expected: AnimationKeyEvent['direction'],
  direction: AnimationDirection,
): boolean {
  return expected === 'both' || expected === direction;
}

function shouldTriggerForPhase(
  event: AnimationKeyEvent,
  previousFrame: number,
  currentFrame: number,
  keyFrame: number,
  wrapped: boolean,
  direction: AnimationDirection,
): boolean {
  if (previousFrame === currentFrame && !event.fireOnSeek) {
    return false;
  }
  const crossed = didCrossKey(previousFrame, currentFrame, keyFrame, wrapped, direction);
  if (event.phase === 'exact') {
    return crossed;
  }
  if (event.phase === 'leave') {
    return crossed;
  }
  return crossed;
}

function didCrossKey(
  previousFrame: number,
  currentFrame: number,
  keyFrame: number,
  wrapped: boolean,
  direction: AnimationDirection,
): boolean {
  if (direction === 'backward') {
    if (!wrapped) {
      return previousFrame > keyFrame && currentFrame <= keyFrame;
    }
    return previousFrame > keyFrame || currentFrame <= keyFrame;
  }
  if (!wrapped) {
    return previousFrame < keyFrame && currentFrame >= keyFrame;
  }
  return previousFrame < keyFrame || currentFrame >= keyFrame;
}

function didWrapAround(
  previousFrame: number,
  currentFrame: number,
  direction: AnimationDirection,
  loop: boolean,
): boolean {
  if (!loop) return false;
  if (direction === 'backward') {
    return currentFrame > previousFrame;
  }
  return currentFrame < previousFrame;
}

function buildAnimationEventPayload(
  entity: Entity,
  track: AnimationTrack,
  label: AnimationLabel,
  key: AnimationKeyframe,
  event: AnimationKeyEvent,
  localFrame: number,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    selfId: entity.id,
    label: label.name,
    track: track.prop,
    keyFrame: key.frame,
    localFrame,
    eventSignal: event.signal,
  };
  for (const set of event.sets) {
    if (!set.key) continue;
    if (set.from) {
      const resolved = resolveEventPayloadFrom(set.from, payload, entity);
      if (resolved !== undefined) {
        payload[set.key] = resolved;
        continue;
      }
    }
    if (set.value !== undefined) {
      payload[set.key] = set.value;
    }
  }
  return payload;
}

function resolveEventPayloadFrom(
  from: string,
  ctxPayload: Record<string, unknown>,
  entity: Entity,
): unknown {
  const normalized = from.trim();
  if (!normalized) return undefined;
  if (normalized === 'self.id') return entity.id;
  if (normalized.startsWith('ctx.')) {
    return readPath(ctxPayload, normalized.slice('ctx.'.length));
  }
  return undefined;
}

function applyLayeredWrites(
  entity: Entity,
  writes: LayerTrackWrite[],
  policy: AnimationLayerConflictPolicy,
): void {
  if (writes.length === 0) return;
  const writesByProp = new Map<string, LayerTrackWrite[]>();
  for (const write of writes) {
    const bucket = writesByProp.get(write.prop);
    if (bucket) {
      bucket.push(write);
    } else {
      writesByProp.set(write.prop, [write]);
    }
  }

  for (const [prop, conflicts] of writesByProp.entries()) {
    const selected = conflicts.sort((left, right) => compareWrites(left, right, policy))[0];
    if (!selected) continue;
    applyTrackValue(entity, prop, selected.value);
  }
}

function compareWrites(
  left: LayerTrackWrite,
  right: LayerTrackWrite,
  policy: AnimationLayerConflictPolicy,
): number {
  if (policy === 'weight') {
    if (left.weight !== right.weight) return right.weight - left.weight;
    if (left.priority !== right.priority) return right.priority - left.priority;
    return right.order - left.order;
  }
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.weight !== right.weight) return right.weight - left.weight;
  return right.order - left.order;
}

function collectActiveLayers(controller: AnimationControllerComponent): ActiveLayerSnapshot[] {
  if (controller.mode !== 'layered') {
    return [
      {
        id: 'default',
        order: 0,
        priority: 0,
        weight: 1,
        writeMask: [],
        blockMask: [],
        state: {
          playing: controller.playing,
          currentLabel: controller.currentLabel,
          localFrame: controller.localFrame,
          speedScale: controller.speedScale,
          direction: controller.direction,
          loopOverride: controller.loopOverride,
          fallbackLabel: controller.fallbackLabel,
        },
      },
    ];
  }

  const snapshots: ActiveLayerSnapshot[] = [];
  for (let i = 0; i < controller.layers.length; i++) {
    const layer = controller.layers[i];
    if (!layer.enabled) continue;
    snapshots.push({
      id: layer.id,
      order: i,
      priority: layer.priority,
      weight: layer.weight,
      writeMask: layer.writeMask,
      blockMask: layer.blockMask,
      state: layer.state,
    });
  }
  return snapshots;
}

function isTrackAllowedForLayer(prop: string, writeMask: string[], blockMask: string[]): boolean {
  if (blockMask.some((pattern) => matchMask(pattern, prop))) {
    return false;
  }
  if (writeMask.length === 0) {
    return true;
  }
  return writeMask.some((pattern) => matchMask(pattern, prop));
}

function matchMask(mask: string, path: string): boolean {
  const escaped = mask
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(path);
}

function advanceLayerState(state: AnimationLayerState, label: AnimationLabel, frameDelta: number): void {
  if (state.playing) {
    const directionSign = directionToSign(state.direction);
    const nextFrame =
      state.localFrame + frameDelta * directionSign * Math.max(0, state.speedScale) * Math.max(0, label.speed);
    const loop = state.loopOverride ?? label.loop;
    state.localFrame = normalizeFrame(nextFrame, label.duration, loop);
    if (!loop && isAnimationEnded(state.localFrame, label.duration, state.direction)) {
      state.playing = false;
      if (state.fallbackLabel && state.currentLabel !== state.fallbackLabel) {
        state.currentLabel = state.fallbackLabel;
        state.localFrame = 0;
        state.playing = true;
        state.loopOverride = undefined;
        state.fallbackLabel = undefined;
      }
    }
  } else {
    state.localFrame = normalizeFrame(state.localFrame, label.duration, true);
  }
}

function consumeAnimationControllerActions(
  controller: AnimationControllerComponent,
): Array<{ action: AnimationActionName; args: Record<string, unknown> }> {
  const consumed: Array<{ action: AnimationActionName; args: Record<string, unknown> }> = [];
  for (const action of controller.allowedActions) {
    const request = controller.actionRequests[action];
    if (!request?.pending) continue;
    consumed.push({
      action,
      args: request.args ?? {},
    });
    request.pending = false;
    request.args = {};
  }
  return consumed;
}

function applyAnimationControllerAction(
  controller: AnimationControllerComponent,
  action: AnimationActionName,
  args: Record<string, unknown>,
): void {
  const targetLayerId = typeof args.layerId === 'string' ? args.layerId.trim() : '';
  const targetLayer = targetLayerId
    ? controller.layers.find((layer) => layer.id === targetLayerId)
    : controller.layers[0];
  const targetState =
    controller.mode === 'layered'
      ? targetLayer?.state
      : {
          playing: controller.playing,
          currentLabel: controller.currentLabel,
          localFrame: controller.localFrame,
          speedScale: controller.speedScale,
          direction: controller.direction,
          loopOverride: controller.loopOverride,
          fallbackLabel: controller.fallbackLabel,
        };

  switch (action) {
    case 'setLabel':
    case 'setLayerLabel': {
      if (!targetState) return;
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return;
      targetState.currentLabel = label;
      if (toBoolean(args.restart, false)) targetState.localFrame = 0;
      targetState.playing = toBoolean(args.keepPlaying, true);
      break;
    }
    case 'playOnce':
    case 'playLayerOnce': {
      if (!targetState) return;
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return;
      targetState.currentLabel = label;
      targetState.playing = true;
      targetState.localFrame = 0;
      targetState.loopOverride = false;
      if (typeof args.fallbackLabel === 'string' && args.fallbackLabel.trim()) {
        targetState.fallbackLabel = args.fallbackLabel.trim();
      }
      break;
    }
    case 'pause':
    case 'pauseLayer': {
      if (!targetState) return;
      targetState.playing = false;
      break;
    }
    case 'resume':
    case 'resumeLayer': {
      if (!targetState) return;
      targetState.playing = true;
      break;
    }
    case 'setSpeed': {
      if (!targetState) return;
      targetState.speedScale = Math.max(0, toNumber(args.speed, targetState.speedScale));
      break;
    }
    case 'setLoopOverride': {
      if (!targetState) return;
      targetState.loopOverride = toBooleanOrUndefined(args.loop);
      break;
    }
    case 'setLayerWeight': {
      if (!targetLayer) return;
      targetLayer.weight = Math.max(0, toNumber(args.weight, targetLayer.weight));
      break;
    }
    case 'enableLayer': {
      if (!targetLayer) return;
      targetLayer.enabled = true;
      break;
    }
    case 'disableLayer': {
      if (!targetLayer) return;
      targetLayer.enabled = false;
      break;
    }
  }

  if (controller.mode !== 'layered') {
    controller.playing = targetState?.playing ?? controller.playing;
    controller.currentLabel = targetState?.currentLabel;
    controller.localFrame = targetState?.localFrame ?? controller.localFrame;
    controller.speedScale = targetState?.speedScale ?? controller.speedScale;
    controller.direction = targetState?.direction ?? controller.direction;
    controller.loopOverride = targetState?.loopOverride;
    controller.fallbackLabel = targetState?.fallbackLabel;
  }
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toBooleanOrUndefined(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return toBoolean(value, false);
}

function sampleTrack(track: AnimationTrack, frame: number): AnimationKeyValue | undefined {
  const keys = track.keys;
  if (keys.length === 0) {
    return undefined;
  }
  const sortedKeys = [...keys].sort((left, right) => left.frame - right.frame);

  if (frame <= sortedKeys[0].frame) {
    return sortedKeys[0].value;
  }

  for (let i = 0; i < sortedKeys.length - 1; i++) {
    const from = sortedKeys[i];
    const to = sortedKeys[i + 1];
    if (frame >= to.frame) {
      continue;
    }

    const t = clamp01((frame - from.frame) / Math.max(0.0001, to.frame - from.frame));
    return interpolateValue(from, to, t, track.interpolation);
  }

  return sortedKeys[sortedKeys.length - 1].value;
}

function interpolateValue(
  from: AnimationKeyframe,
  to: AnimationKeyframe,
  t: number,
  interpolation: AnimationInterpolation,
): AnimationKeyValue {
  if (interpolation === 'hold') {
    return from.value;
  }
  if (typeof from.value !== 'number' || typeof to.value !== 'number') {
    return t < 1 ? from.value : to.value;
  }

  const eased = applyKeyEasing(from.easing, t);
  return from.value + (to.value - from.value) * eased;
}

function captureRelativeBaselines(entity: Entity, label: AnimationLabel): Map<string, number> {
  const baselines = new Map<string, number>();
  for (const track of label.tracks) {
    if (track.valueMode !== 'relative') {
      continue;
    }
    const currentValue = readNumericTrackValue(entity, track.prop);
    if (currentValue !== undefined) {
      baselines.set(track.prop, currentValue);
    } else {
      baselines.set(track.prop, 0);
    }
  }
  return baselines;
}

function applyTrackValue(entity: Entity, propPath: string, value: AnimationKeyValue): void {
  const trimmedPath = propPath.trim();
  if (!trimmedPath) {
    return;
  }

  const pathSegments = trimmedPath.split('.');
  if (pathSegments.length < 2) {
    return;
  }

  const [scope, ...restPath] = pathSegments;
  const component = getComponentByScope(entity, scope);
  if (!component || restPath.length === 0) {
    return;
  }

  if (component.type === 'Sprite' && restPath.length === 1 && restPath[0] === 'textureFrame') {
    if (component.texture.kind === 'atlasFrame' && typeof value === 'string') {
      component.texture.atlasFrame = value;
    }
    return;
  }

  setNestedValue(component as unknown as Record<string, unknown>, restPath, value);
}

function readNumericTrackValue(entity: Entity, propPath: string): number | undefined {
  const trimmedPath = propPath.trim();
  if (!trimmedPath) {
    return undefined;
  }

  const pathSegments = trimmedPath.split('.');
  if (pathSegments.length < 2) {
    return undefined;
  }

  const [scope, ...restPath] = pathSegments;
  const component = getComponentByScope(entity, scope);
  if (!component || restPath.length === 0) {
    return undefined;
  }

  const value = getNestedValue(component as unknown as Record<string, unknown>, restPath);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getComponentByScope(entity: Entity, scope: string): AnyComponent | undefined {
  const normalized = scope.toLowerCase();
  const componentType = COMPONENT_SCOPE_MAP[normalized];
  if (!componentType) {
    return undefined;
  }
  return entity.components.get(componentType);
}

const COMPONENT_SCOPE_MAP: Record<string, string> = {
  transform: 'Transform',
  sprite: 'Sprite',
  rigidbody: 'RigidBody',
  boxcollider: 'BoxCollider',
  circlecollider: 'CircleCollider',
  polygoncollider: 'PolygonCollider',
  graphic: 'Graphic',
  camera: 'Camera',
  particleemitter: 'ParticleEmitter',
  animations: 'Animations',
  animationcontroller: 'AnimationController',
};

function setNestedValue(target: Record<string, unknown>, path: string[], value: AnimationKeyValue): void {
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return;
    }
    cursor = next as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function getNestedValue(target: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = target;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  let cursor: unknown = source;
  for (const segment of path.split('.')) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function applyKeyEasing(easing: string | undefined, t: number): number {
  if (!easing) {
    return t;
  }
  const parsed = parseCubicBezier(easing);
  if (!parsed) {
    return t;
  }
  return solveCubicBezier(parsed.x1, parsed.y1, parsed.x2, parsed.y2, t);
}

function parseCubicBezier(easing: string) {
  const match = easing.trim().match(BEZIER_REGEX);
  if (!match) {
    return undefined;
  }

  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return undefined;
  }
  return { x1, y1, x2, y2 };
}

function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  const clampedT = clamp01(t);

  // 先用牛顿法近似 x(s)=t 的 s，再回代 y(s)
  let s = clampedT;
  for (let i = 0; i < 6; i++) {
    const x = cubicBezierPoint(0, x1, x2, 1, s);
    const dx = cubicBezierDerivative(0, x1, x2, 1, s);
    if (Math.abs(dx) < 1e-6) {
      break;
    }
    s -= (x - clampedT) / dx;
    s = clamp01(s);
  }

  return cubicBezierPoint(0, y1, y2, 1, s);
}

function cubicBezierPoint(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const oneMinusT = 1 - t;
  return (
    oneMinusT ** 3 * p0 +
    3 * oneMinusT ** 2 * t * p1 +
    3 * oneMinusT * t ** 2 * p2 +
    t ** 3 * p3
  );
}

function cubicBezierDerivative(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const oneMinusT = 1 - t;
  return (
    3 * oneMinusT ** 2 * (p1 - p0) +
    6 * oneMinusT * t * (p2 - p1) +
    3 * t ** 2 * (p3 - p2)
  );
}

function directionToSign(direction: AnimationDirection): 1 | -1 {
  return direction === 'backward' ? -1 : 1;
}

function normalizeFrame(frame: number, duration: number, loop: boolean): number {
  const safeDuration = Math.max(0, duration);
  if (safeDuration <= 0) {
    return 0;
  }
  if (loop) {
    return ((frame % safeDuration) + safeDuration) % safeDuration;
  }
  return clamp(frame, 0, safeDuration);
}

function isAnimationEnded(frame: number, duration: number, direction: AnimationDirection): boolean {
  if (duration <= 0) return true;
  if (direction === 'backward') {
    return frame <= 0;
  }
  return frame >= duration;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
