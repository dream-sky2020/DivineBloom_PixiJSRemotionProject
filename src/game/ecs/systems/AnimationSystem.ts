import { System } from '../../types';
import type { AnyComponent, Entity } from '../../types';
import type {
  AnimationControllerComponent,
  AnimationDirection,
} from '../components/AnimationController';
import type {
  AnimationInterpolation,
  AnimationKeyframe,
  AnimationKeyValue,
  AnimationLabel,
  AnimationTrack,
  AnimationsComponent,
} from '../components/Animations';

const DEFAULT_FPS = 60;
const BEZIER_REGEX =
  /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/i;

interface EntityAnimationRuntime {
  activeLabel?: string;
  relativeBaseByTrack: Map<string, number>;
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

      const label = resolveLabel(animations, controller);
      if (!label) {
        continue;
      }

      const runtime = this.getOrCreateRuntime(entityId);
      if (runtime.activeLabel !== label.name) {
        runtime.activeLabel = label.name;
        runtime.relativeBaseByTrack = captureRelativeBaselines(entity, label);
      }

      if (controller.playing) {
        const directionSign = directionToSign(controller.direction);
        const nextFrame =
          controller.localFrame +
          frameDelta * directionSign * Math.max(0, controller.speedScale) * Math.max(0, label.speed);
        const loop = controller.loopOverride ?? label.loop;
        controller.localFrame = normalizeFrame(nextFrame, label.duration, loop);
      } else {
        controller.localFrame = normalizeFrame(controller.localFrame, label.duration, true);
      }

      applyLabelToEntity(entity, label, controller.localFrame, runtime);
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
      activeLabel: undefined,
      relativeBaseByTrack: new Map(),
    };
    this.runtimeByEntity.set(entityId, runtime);
    return runtime;
  }
}

function resolveLabel(
  animations: AnimationsComponent,
  controller: AnimationControllerComponent,
): AnimationLabel | undefined {
  if (!animations.labels || Object.keys(animations.labels).length === 0) {
    return undefined;
  }

  const fallbackLabelName = animations.defaultLabel ?? Object.keys(animations.labels)[0];
  const requestedLabel = controller.currentLabel ?? fallbackLabelName;
  const label = animations.labels[requestedLabel];
  if (label) {
    controller.currentLabel = requestedLabel;
    return label;
  }

  if (!fallbackLabelName) {
    return undefined;
  }
  controller.currentLabel = fallbackLabelName;
  return animations.labels[fallbackLabelName];
}

function applyLabelToEntity(
  entity: Entity,
  label: AnimationLabel,
  frame: number,
  runtime: EntityAnimationRuntime,
): void {
  for (const track of label.tracks) {
    const value = sampleTrack(track, frame);
    if (value === undefined) {
      continue;
    }
    let finalValue = value;
    if (track.valueMode === 'relative' && typeof value === 'number') {
      finalValue = (runtime.relativeBaseByTrack.get(track.prop) ?? 0) + value;
    }
    applyTrackValue(entity, track.prop, finalValue);
  }
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
