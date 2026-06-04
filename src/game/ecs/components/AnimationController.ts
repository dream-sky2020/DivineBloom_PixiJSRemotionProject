import type {
  AnimationActionName,
  AnimationActionRequestMap,
  AnimationControllerComponent,
} from '../../types';

export type {
  AnimationActionName,
  AnimationActionRequestMap,
  AnimationControllerComponent,
} from '../../types';

export const DEFAULT_ANIMATION_ACTIONS: AnimationActionName[] = [
  'setLabel',
  'playOnce',
  'pause',
  'resume',
  'setSpeed',
  'setLoopOverride',
  'setLayerLabel',
  'playLayerOnce',
  'pauseLayer',
  'resumeLayer',
  'setLayerWeight',
  'enableLayer',
  'disableLayer',
];

export const createAnimationController = (
  options: Partial<Omit<AnimationControllerComponent, 'type'>> = {},
): AnimationControllerComponent => ({
  type: 'AnimationController',
  mode: options.mode ?? 'single',
  layerConflictPolicy: options.layerConflictPolicy ?? 'byMask',
  playing: options.playing ?? true,
  currentLabel: options.currentLabel,
  localFrame: options.localFrame ?? 0,
  speedScale: options.speedScale ?? 1,
  direction: options.direction ?? 'forward',
  loopOverride: options.loopOverride,
  fallbackLabel: options.fallbackLabel,
  layers: options.layers ?? [],
  allowedActions: options.allowedActions ?? [...DEFAULT_ANIMATION_ACTIONS],
  actionRequests:
    options.actionRequests ?? createAnimationActionRequestState(options.allowedActions ?? DEFAULT_ANIMATION_ACTIONS),
});

export function createAnimationActionRequestState(
  allowedActions: readonly AnimationActionName[],
): AnimationActionRequestMap {
  const state: AnimationActionRequestMap = {};
  for (const action of allowedActions) {
    state[action] = {
      pending: false,
      args: {},
    };
  }
  return state;
}

export function queueAnimationControllerAction(
  controller: AnimationControllerComponent,
  action: string,
  args: Record<string, unknown> = {},
): boolean {
  if (!isAnimationActionName(action)) return false;
  if (!controller.allowedActions.includes(action)) return false;
  if (!controller.actionRequests[action]) {
    controller.actionRequests[action] = {
      pending: false,
      args: {},
    };
  }
  const request = controller.actionRequests[action];
  if (!request) return false;
  request.pending = true;
  request.args = { ...args };
  return true;
}

export function consumeAnimationControllerActions(
  controller: AnimationControllerComponent,
): Array<{ action: AnimationActionName; args: Record<string, unknown> }> {
  const consumed: Array<{ action: AnimationActionName; args: Record<string, unknown> }> = [];
  for (const action of controller.allowedActions) {
    const request = controller.actionRequests[action];
    if (!request?.pending) continue;
    consumed.push({
      action,
      args: request.args,
    });
    request.pending = false;
    request.args = {};
  }
  return consumed;
}

export function applyAnimationControllerAction(
  controller: AnimationControllerComponent,
  action: string,
  args: Record<string, unknown> = {},
): boolean {
  if (!isAnimationActionName(action)) {
    return false;
  }
  if (!controller.allowedActions.includes(action)) {
    return false;
  }

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
      if (!targetState) return false;
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return false;
      const restart = toBoolean(args.restart, false);
      const keepPlaying = toBoolean(args.keepPlaying, true);
      targetState.currentLabel = label;
      targetState.playing = keepPlaying;
      if (restart) {
        targetState.localFrame = 0;
      }
      break;
    }
    case 'playOnce':
    case 'playLayerOnce': {
      if (!targetState) return false;
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return false;
      targetState.currentLabel = label;
      targetState.playing = true;
      targetState.localFrame = 0;
      targetState.loopOverride = false;
      targetState.fallbackLabel =
        typeof args.fallbackLabel === 'string' && args.fallbackLabel.trim()
          ? args.fallbackLabel.trim()
          : targetState.fallbackLabel;
      break;
    }
    case 'pause':
    case 'pauseLayer': {
      if (!targetState) return false;
      targetState.playing = false;
      break;
    }
    case 'resume':
    case 'resumeLayer': {
      if (!targetState) return false;
      targetState.playing = true;
      break;
    }
    case 'setSpeed': {
      if (!targetState) return false;
      const speed = toNumber(args.speed, targetState.speedScale);
      targetState.speedScale = Math.max(0, speed);
      break;
    }
    case 'setLoopOverride': {
      if (!targetState) return false;
      const loop = toBooleanOrUndefined(args.loop);
      targetState.loopOverride = loop;
      break;
    }
    case 'setLayerWeight': {
      if (!targetLayer) return false;
      targetLayer.weight = Math.max(0, toNumber(args.weight, targetLayer.weight));
      break;
    }
    case 'enableLayer': {
      if (!targetLayer) return false;
      targetLayer.enabled = true;
      break;
    }
    case 'disableLayer': {
      if (!targetLayer) return false;
      targetLayer.enabled = false;
      break;
    }
    default:
      return false;
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
  return true;
}

function isAnimationActionName(value: string): value is AnimationActionName {
  return (
    value === 'setLabel' ||
    value === 'playOnce' ||
    value === 'pause' ||
    value === 'resume' ||
    value === 'setSpeed' ||
    value === 'setLoopOverride' ||
    value === 'setLayerLabel' ||
    value === 'playLayerOnce' ||
    value === 'pauseLayer' ||
    value === 'resumeLayer' ||
    value === 'setLayerWeight' ||
    value === 'enableLayer' ||
    value === 'disableLayer'
  );
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
