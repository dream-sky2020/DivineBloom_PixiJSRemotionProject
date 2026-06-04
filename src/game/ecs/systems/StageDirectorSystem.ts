import { System } from '../../types';
import type { Entity, StageScriptAsset, StageScriptLibraryAsset, StageScriptTrack, WorldData } from '../../types';
import type {
  StageDirectorActionName,
  StageDirectorControllerComponent,
} from '../components/StageDirectorController';
import { consumeStageDirectorControllerActions } from '../components/StageDirectorController';
import { enqueueSignalEvent } from '../signalRuntime';

const LOG_PREFIX = '[StageDirectorSystem]';
const CONFLICT_LOG_THROTTLE_MS = 1000;

interface ActiveStageScriptInstance {
  instanceId: string;
  script: StageScriptAsset;
  priority: number;
  speed: number;
  loop: boolean;
  paused: boolean;
  createdAt: number;
  startedAt: number;
  localFrame: number;
  lastFrame: number;
  roleBindings: Record<string, string>;
  relativeBaseByEntityProp: Map<string, number>;
  firedEventKeys: Set<string>;
  eventLastFiredAt: Map<string, number>;
  firedCueFrames: Set<number>;
}

interface QueuedStagePlayRequest {
  args: Record<string, unknown>;
  enqueuedAt: number;
}

interface DirectorRuntime {
  seq: number;
  instances: Map<string, ActiveStageScriptInstance>;
  playQueue: QueuedStagePlayRequest[];
}

interface TrackWriteCandidate {
  entity: Entity;
  prop: string;
  value: string | number | boolean;
  scriptId: string;
  roleId: string;
  trackOrder: number;
  instancePriority: number;
  startedAt: number;
  instanceId: string;
}

export class EcsStageDirectorSystem extends System {
  private readonly runtimeByDirectorId = new Map<string, DirectorRuntime>();
  private readonly conflictLogAtByKey = new Map<string, number>();
  private stageScriptLibrary?: StageScriptLibraryAsset;

  bindWorldData(worldData: WorldData): void {
    this.stageScriptLibrary = worldData.stageScriptLibrary;
  }

  update(entities: Entity[], deltaTime: number): void {
    const activeDirectorIds = new Set<string>();
    const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
    const now = Date.now();

    for (const entity of entities) {
      const controller = entity.components.get('StageDirectorController') as
        | StageDirectorControllerComponent
        | undefined;
      if (!controller || !controller.id) continue;

      activeDirectorIds.add(controller.id);
      const runtime = this.getOrCreateRuntime(controller.id);
      const actions = consumeStageDirectorControllerActions(controller);
      for (const request of actions) {
        this.applyAction(runtime, controller, request.action, request.args, now, entityById);
      }
      this.flushQueuedPlayRequests(runtime, controller, now, entityById);
      this.tickInstances(runtime, controller, entityById, deltaTime, now);
    }

    for (const directorId of this.runtimeByDirectorId.keys()) {
      if (!activeDirectorIds.has(directorId)) {
        this.runtimeByDirectorId.delete(directorId);
      }
    }
  }

  private getOrCreateRuntime(directorId: string): DirectorRuntime {
    const existing = this.runtimeByDirectorId.get(directorId);
    if (existing) return existing;
    const runtime: DirectorRuntime = { seq: 0, instances: new Map(), playQueue: [] };
    this.runtimeByDirectorId.set(directorId, runtime);
    return runtime;
  }

  private applyAction(
    runtime: DirectorRuntime,
    controller: StageDirectorControllerComponent,
    action: StageDirectorActionName,
    args: Record<string, unknown>,
    now: number,
    entityById: Map<string, Entity>,
  ): void {
    switch (action) {
      case 'playScript':
        this.playScript(runtime, controller, args, now, entityById);
        break;
      case 'stopScript':
        this.stopScript(runtime, args);
        break;
      case 'stopAll':
        runtime.instances.clear();
        runtime.playQueue = [];
        break;
      case 'pauseScript':
        this.pauseOrResume(runtime, args, true);
        break;
      case 'resumeScript':
        this.pauseOrResume(runtime, args, false);
        break;
    }
  }

  private playScript(
    runtime: DirectorRuntime,
    controller: StageDirectorControllerComponent,
    args: Record<string, unknown>,
    now: number,
    entityById: Map<string, Entity>,
  ): void {
    if (!controller.enabled) return;
    const scriptId = readString(args, 'scriptId');
    if (!scriptId) return;
    const script = this.stageScriptLibrary?.scripts?.[scriptId];
    if (!script) {
      this.handleUnknownScript(scriptId);
      return;
    }
    if (!this.validateScope(controller, args)) return;

    const roleBindings = readRoleBindings(args);
    if (!this.validateRoleBindings(script, roleBindings, entityById)) return;

    const interruptPolicy = (readString(args, 'interruptPolicy') ||
      script.interruptPolicy) as StageScriptAsset['interruptPolicy'];
    if (runtime.instances.size >= controller.maxActiveInstances) {
      if (interruptPolicy === 'queue') {
        runtime.playQueue.push({ args: { ...args }, enqueuedAt: now });
          this.logInfo(
            `queue playScript: director=${controller.id} script=${scriptId} policy=${interruptPolicy} queueSize=${runtime.playQueue.length}`,
          );
        return;
      }
      if (interruptPolicy === 'reject') {
        this.logInfo(
          `reject playScript: director=${controller.id} script=${scriptId} policy=${interruptPolicy} active=${runtime.instances.size}`,
        );
        return;
      }
      this.evictOldestInstance(runtime);
    }

    const instanceId = readString(args, 'instanceId') || this.nextInstanceId(controller, runtime);
    runtime.instances.set(instanceId, {
      instanceId,
      script,
      priority: toNumber(args.priority, controller.defaultPriority),
      speed: Math.max(0, toNumber(args.speed, 1)),
      loop: toBoolean(args.loop, false),
      paused: false,
      createdAt: now,
      startedAt: now,
      localFrame: 0,
      lastFrame: 0,
      roleBindings,
      relativeBaseByEntityProp: new Map(),
      firedEventKeys: new Set(),
      eventLastFiredAt: new Map(),
      firedCueFrames: new Set(),
    });
    this.logInfo(
      `start script instance: director=${controller.id} instance=${instanceId} script=${script.id} priority=${toNumber(args.priority, controller.defaultPriority)} policy=${controller.conflictPolicy}`,
    );
  }

  private stopScript(runtime: DirectorRuntime, args: Record<string, unknown>): void {
    const instanceId = readString(args, 'instanceId');
    if (instanceId) {
      runtime.instances.delete(instanceId);
      return;
    }
    const scriptId = readString(args, 'scriptId');
    if (!scriptId) return;
    for (const [id, instance] of runtime.instances.entries()) {
      if (instance.script.id === scriptId) {
        runtime.instances.delete(id);
      }
    }
  }

  private pauseOrResume(runtime: DirectorRuntime, args: Record<string, unknown>, paused: boolean): void {
    const instanceId = readString(args, 'instanceId');
    if (instanceId) {
      const instance = runtime.instances.get(instanceId);
      if (instance) instance.paused = paused;
      return;
    }
    const scriptId = readString(args, 'scriptId');
    for (const instance of runtime.instances.values()) {
      if (!scriptId || instance.script.id === scriptId) {
        instance.paused = paused;
      }
    }
  }

  private flushQueuedPlayRequests(
    runtime: DirectorRuntime,
    controller: StageDirectorControllerComponent,
    now: number,
    entityById: Map<string, Entity>,
  ): void {
    if (!controller.enabled || runtime.playQueue.length === 0) return;
    while (runtime.playQueue.length > 0 && runtime.instances.size < controller.maxActiveInstances) {
      const queued = runtime.playQueue.shift();
      if (!queued) break;
      this.playScript(runtime, controller, queued.args, Math.max(now, queued.enqueuedAt), entityById);
    }
  }

  private tickInstances(
    runtime: DirectorRuntime,
    controller: StageDirectorControllerComponent,
    entityById: Map<string, Entity>,
    deltaTime: number,
    now: number,
  ): void {
    if (!controller.enabled || runtime.instances.size === 0) return;
    const writes: TrackWriteCandidate[] = [];
    const toDelete: string[] = [];

    for (const instance of runtime.instances.values()) {
      if (instance.paused) continue;
      const frameDelta = Math.max(0, deltaTime) * instance.script.fps * instance.speed;
      instance.lastFrame = instance.localFrame;
      instance.localFrame += frameDelta;

      const duration = Math.max(0.0001, instance.script.duration);
      if (instance.localFrame > duration) {
        if (instance.loop) {
          instance.localFrame = instance.localFrame % duration;
        } else {
          instance.localFrame = duration;
        }
      }

      this.dispatchStageKeyEvents(instance, now);
      this.dispatchStageCues(instance, now);
      this.collectTrackWrites(instance, entityById, writes);

      if (!instance.loop && instance.localFrame >= duration) {
        if (instance.script.completeSignal) {
          enqueueSignalEvent({
            id: instance.script.completeSignal,
            payload: {
              scriptId: instance.script.id,
              instanceId: instance.instanceId,
            },
          });
        }
        toDelete.push(instance.instanceId);
        this.logInfo(
          `complete script instance: director=${controller.id} instance=${instance.instanceId} script=${instance.script.id}`,
        );
      }
    }

    this.applyConflictResolvedWrites(controller, writes, now);
    for (const id of toDelete) {
      runtime.instances.delete(id);
    }
  }

  private collectTrackWrites(
    instance: ActiveStageScriptInstance,
    entityById: Map<string, Entity>,
    writes: TrackWriteCandidate[],
  ): void {
    for (let trackIndex = 0; trackIndex < instance.script.tracks.length; trackIndex++) {
      const track = instance.script.tracks[trackIndex];
      const entityId = instance.roleBindings[track.role];
      if (!entityId) continue;
      const entity = entityById.get(String(entityId));
      if (!entity) continue;
      const sampled = sampleStageTrack(track, instance.localFrame);
      if (sampled === undefined) continue;

      let value = sampled;
      if (track.valueMode === 'relative' && typeof sampled === 'number') {
        const baseKey = `${entity.id}|${track.prop}`;
        if (!instance.relativeBaseByEntityProp.has(baseKey)) {
          const base = readNumericPath(entity, track.prop) ?? 0;
          instance.relativeBaseByEntityProp.set(baseKey, base);
        }
        value = (instance.relativeBaseByEntityProp.get(baseKey) ?? 0) + sampled;
      }

      writes.push({
        entity,
        prop: track.prop,
        value,
        scriptId: instance.script.id,
        roleId: track.role,
        trackOrder: trackIndex,
        instancePriority: instance.priority,
        startedAt: instance.startedAt,
        instanceId: instance.instanceId,
      });
    }
  }

  private applyConflictResolvedWrites(
    controller: StageDirectorControllerComponent,
    writes: TrackWriteCandidate[],
    now: number,
  ): void {
    const grouped = new Map<string, TrackWriteCandidate[]>();
    for (const write of writes) {
      const key = `${write.entity.id}|${write.prop}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(write);
      grouped.set(key, bucket);
    }

    for (const [groupKey, bucket] of grouped.entries()) {
      bucket.sort((a, b) => compareWritesByPolicy(a, b, controller.conflictPolicy));
      const selected = bucket[0];
      if (!selected) continue;
      if (bucket.length > 1) {
        this.logConflictResolution(controller, groupKey, bucket, selected, now);
      }
      applyPathValue(selected.entity, selected.prop, selected.value);
    }
  }

  private dispatchStageKeyEvents(instance: ActiveStageScriptInstance, now: number): void {
    for (let trackIndex = 0; trackIndex < instance.script.tracks.length; trackIndex++) {
      const track = instance.script.tracks[trackIndex];
      for (let keyIndex = 0; keyIndex < track.keys.length; keyIndex++) {
        const key = track.keys[keyIndex];
        if (!didCross(instance.lastFrame, instance.localFrame, key.frame, instance.localFrame < instance.lastFrame)) {
          continue;
        }
        for (let eventIndex = 0; eventIndex < key.events.length; eventIndex++) {
          const event = key.events[eventIndex];
          const eventKey = `${trackIndex}:${keyIndex}:${eventIndex}`;
          if (event.once && instance.firedEventKeys.has(eventKey)) continue;
          const lastFire = instance.eventLastFiredAt.get(eventKey) ?? 0;
          if (event.cooldownMs > 0 && now - lastFire < event.cooldownMs) continue;
          instance.eventLastFiredAt.set(eventKey, now);
          if (event.once) instance.firedEventKeys.add(eventKey);
          enqueueSignalEvent({
            id: event.signal,
            payload: resolveStagePayloadSets(event.payloadSets, instance, event.signal),
          });
        }
      }
    }
  }

  private dispatchStageCues(instance: ActiveStageScriptInstance, _now: number): void {
    for (const cue of instance.script.cues) {
      if (!didCross(instance.lastFrame, instance.localFrame, cue.frame, instance.localFrame < instance.lastFrame)) {
        continue;
      }
      if (!instance.loop && instance.firedCueFrames.has(cue.frame)) continue;
      enqueueSignalEvent({
        id: cue.signal,
        payload: resolveStagePayloadSets(cue.payloadSets, instance, cue.signal),
      });
      if (!instance.loop) {
        instance.firedCueFrames.add(cue.frame);
      }
    }
  }

  private evictOldestInstance(runtime: DirectorRuntime): void {
    let selectedId: string | undefined;
    let selectedCreatedAt = Number.POSITIVE_INFINITY;
    for (const [id, instance] of runtime.instances.entries()) {
      if (instance.createdAt < selectedCreatedAt) {
        selectedCreatedAt = instance.createdAt;
        selectedId = id;
      }
    }
    if (selectedId) runtime.instances.delete(selectedId);
  }

  private nextInstanceId(controller: StageDirectorControllerComponent, runtime: DirectorRuntime): string {
    runtime.seq += 1;
    return `${controller.id}#${runtime.seq}`;
  }

  private validateScope(controller: StageDirectorControllerComponent, args: Record<string, unknown>): boolean {
    if (controller.allowCrossScope) return true;
    const requestedScope = readString(args, 'scope');
    if (!requestedScope) return true;
    if (requestedScope === controller.scope) return true;
    console.warn(
      `[StageDirectorSystem] Scope mismatch: director=${controller.id} scope=${controller.scope} requested=${requestedScope}`,
    );
    return false;
  }

  private validateRoleBindings(
    script: StageScriptAsset,
    roleBindings: Record<string, string>,
    entityById: Map<string, Entity>,
  ): boolean {
    for (const role of script.roles) {
      const entityId = roleBindings[role.id];
      if (role.required && !entityId) {
        console.warn(`[StageDirectorSystem] Missing required role binding: script=${script.id} role=${role.id}`);
        return false;
      }
      if (entityId && !entityById.has(String(entityId))) {
        console.warn(
          `[StageDirectorSystem] Bound entity not found: script=${script.id} role=${role.id} entityId=${entityId}`,
        );
        return false;
      }
    }
    return true;
  }

  private handleUnknownScript(scriptId: string): void {
    const mode = this.stageScriptLibrary?.unknownScript || 'error';
    if (mode === 'ignore') return;
    const message = `[StageDirectorSystem] Unknown stage script: ${scriptId}`;
    if (mode === 'warn') {
      console.warn(message);
      return;
    }
    console.error(message);
  }

  private logInfo(message: string): void {
    console.info(`${LOG_PREFIX} ${message}`);
  }

  private logConflictResolution(
    controller: StageDirectorControllerComponent,
    groupKey: string,
    bucket: TrackWriteCandidate[],
    selected: TrackWriteCandidate,
    now: number,
  ): void {
    const lastLoggedAt = this.conflictLogAtByKey.get(groupKey) ?? 0;
    if (now - lastLoggedAt < CONFLICT_LOG_THROTTLE_MS) return;
    this.conflictLogAtByKey.set(groupKey, now);

    const candidates = bucket
      .slice(0, 4)
      .map(
        (item) =>
          `${item.instanceId}[script=${item.scriptId},role=${item.roleId},prio=${item.instancePriority},track=${item.trackOrder}]`,
      )
      .join(' | ');
    console.info(
      `${LOG_PREFIX} conflict resolved: director=${controller.id} policy=${controller.conflictPolicy} target=${groupKey} selected=${selected.instanceId} candidates=${candidates}`,
    );
  }
}

function compareWritesByPolicy(
  left: TrackWriteCandidate,
  right: TrackWriteCandidate,
  policy: StageDirectorControllerComponent['conflictPolicy'],
): number {
  if (policy === 'stageFirst') {
    const byStage = compareStageOrder(left, right);
    if (byStage !== 0) return byStage;
    return compareLocalOrder(left, right);
  }
  if (policy === 'byMask') {
    const byMask = compareMaskSpecificity(left, right);
    if (byMask !== 0) return byMask;
    return compareLocalOrder(left, right);
  }
  return compareLocalOrder(left, right);
}

function compareLocalOrder(left: TrackWriteCandidate, right: TrackWriteCandidate): number {
  if (left.instancePriority !== right.instancePriority) return right.instancePriority - left.instancePriority;
  if (left.startedAt !== right.startedAt) return right.startedAt - left.startedAt;
  return left.instanceId.localeCompare(right.instanceId);
}

function compareStageOrder(left: TrackWriteCandidate, right: TrackWriteCandidate): number {
  if (left.scriptId !== right.scriptId) return left.scriptId.localeCompare(right.scriptId);
  if (left.trackOrder !== right.trackOrder) return right.trackOrder - left.trackOrder;
  return 0;
}

function compareMaskSpecificity(left: TrackWriteCandidate, right: TrackWriteCandidate): number {
  const leftScore = maskSpecificityScore(left.prop);
  const rightScore = maskSpecificityScore(right.prop);
  if (leftScore !== rightScore) return rightScore - leftScore;
  return 0;
}

function maskSpecificityScore(propPath: string): number {
  const segments = propPath.split('.').filter(Boolean);
  let score = segments.length * 10;
  for (const segment of segments) {
    if (segment.includes('*')) {
      score -= 5;
    }
  }
  return score;
}

function sampleStageTrack(track: StageScriptTrack, frame: number): string | number | boolean | undefined {
  if (track.keys.length === 0) return undefined;
  const sorted = track.keys;
  if (frame <= sorted[0].frame) return sorted[0].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (frame >= to.frame) continue;
    if (track.interpolation === 'hold') return from.value;
    const t = clamp01((frame - from.frame) / Math.max(0.0001, to.frame - from.frame));
    if (typeof from.value !== 'number' || typeof to.value !== 'number') {
      return t < 1 ? from.value : to.value;
    }
    return from.value + (to.value - from.value) * t;
  }
  return sorted[sorted.length - 1].value;
}

function didCross(previousFrame: number, currentFrame: number, targetFrame: number, wrapped: boolean): boolean {
  if (!wrapped) {
    return previousFrame < targetFrame && currentFrame >= targetFrame;
  }
  return previousFrame < targetFrame || currentFrame >= targetFrame;
}

function applyPathValue(entity: Entity, propPath: string, value: string | number | boolean): void {
  const parts = propPath.split('.');
  if (parts.length < 2) return;
  const scope = parts[0].toLowerCase();
  const componentType = scopeToComponent(scope);
  if (!componentType) return;
  const component = entity.components.get(componentType) as unknown as
    | Record<string, unknown>
    | undefined;
  if (!component) return;
  setNestedValue(component, parts.slice(1), value);
}

function readNumericPath(entity: Entity, propPath: string): number | undefined {
  const parts = propPath.split('.');
  if (parts.length < 2) return undefined;
  const scope = parts[0].toLowerCase();
  const componentType = scopeToComponent(scope);
  if (!componentType) return undefined;
  const component = entity.components.get(componentType) as unknown as
    | Record<string, unknown>
    | undefined;
  if (!component) return undefined;
  const value = getNestedValue(component, parts.slice(1));
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function resolveStagePayloadSets(
  sets: Array<{ key: string; from?: string; value?: string | number | boolean }>,
  instance: ActiveStageScriptInstance,
  eventSignal: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    scriptId: instance.script.id,
    instanceId: instance.instanceId,
    localFrame: instance.localFrame,
    eventSignal,
  };
  for (const set of sets) {
    if (!set.key) continue;
    const resolved = resolveSetValue(set.from, set.value, payload, instance);
    if (resolved !== undefined) payload[set.key] = resolved;
  }
  return payload;
}

function resolveSetValue(
  from: string | undefined,
  fallbackValue: string | number | boolean | undefined,
  payloadCtx: Record<string, unknown>,
  instance: ActiveStageScriptInstance,
): unknown {
  if (!from) return fallbackValue;
  if (from.startsWith('role.')) {
    const roleId = from.slice('role.'.length).split('.')[0];
    return instance.roleBindings[roleId];
  }
  if (from.startsWith('ctx.')) {
    return readObjectPath(payloadCtx, from.slice('ctx.'.length));
  }
  return fallbackValue;
}

function scopeToComponent(scope: string): string | undefined {
  switch (scope) {
    case 'transform':
      return 'Transform';
    case 'sprite':
      return 'Sprite';
    case 'rigidbody':
      return 'RigidBody';
    case 'graphic':
      return 'Graphic';
    case 'camera':
      return 'Camera';
    default:
      return undefined;
  }
}

function setNestedValue(target: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return;
    cursor = next as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function getNestedValue(target: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = target;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function readObjectPath(source: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = source;
  for (const key of path.split('.')) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function readRoleBindings(args: Record<string, unknown>): Record<string, string> {
  const bindings: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (!key.startsWith('bind.')) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    bindings[key.slice('bind.'.length)] = value.trim();
  }
  return bindings;
}

function readString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
