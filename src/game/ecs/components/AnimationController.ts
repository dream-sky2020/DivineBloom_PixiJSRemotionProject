import type { Component } from '../../types';

export type AnimationDirection = 'forward' | 'backward';
export type AnimationActionName =
  | 'setLabel'
  | 'playOnce'
  | 'pause'
  | 'resume'
  | 'setSpeed'
  | 'setLoopOverride';

export const DEFAULT_ANIMATION_ACTIONS: AnimationActionName[] = [
  'setLabel',
  'playOnce',
  'pause',
  'resume',
  'setSpeed',
  'setLoopOverride',
];

export interface AnimationControllerComponent extends Component {
  readonly type: 'AnimationController';
  playing: boolean;
  currentLabel?: string;
  localFrame: number;
  speedScale: number;
  direction: AnimationDirection;
  loopOverride?: boolean;
  fallbackLabel?: string;
  allowedActions: AnimationActionName[];
}

export const createAnimationController = (
  options: Partial<Omit<AnimationControllerComponent, 'type'>> = {},
): AnimationControllerComponent => ({
  type: 'AnimationController',
  playing: options.playing ?? true,
  currentLabel: options.currentLabel,
  localFrame: options.localFrame ?? 0,
  speedScale: options.speedScale ?? 1,
  direction: options.direction ?? 'forward',
  loopOverride: options.loopOverride,
  fallbackLabel: options.fallbackLabel,
  allowedActions: options.allowedActions ?? [...DEFAULT_ANIMATION_ACTIONS],
});

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

  switch (action) {
    case 'setLabel': {
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return false;
      const restart = toBoolean(args.restart, false);
      const keepPlaying = toBoolean(args.keepPlaying, true);
      controller.currentLabel = label;
      controller.playing = keepPlaying;
      if (restart) {
        controller.localFrame = 0;
      }
      return true;
    }
    case 'playOnce': {
      const label = typeof args.label === 'string' ? args.label.trim() : '';
      if (!label) return false;
      controller.currentLabel = label;
      controller.playing = true;
      controller.localFrame = 0;
      controller.loopOverride = false;
      controller.fallbackLabel =
        typeof args.fallbackLabel === 'string' && args.fallbackLabel.trim()
          ? args.fallbackLabel.trim()
          : controller.fallbackLabel;
      return true;
    }
    case 'pause': {
      controller.playing = false;
      return true;
    }
    case 'resume': {
      controller.playing = true;
      return true;
    }
    case 'setSpeed': {
      const speed = toNumber(args.speed, controller.speedScale);
      controller.speedScale = Math.max(0, speed);
      return true;
    }
    case 'setLoopOverride': {
      const loop = toBooleanOrUndefined(args.loop);
      controller.loopOverride = loop;
      return true;
    }
    default:
      return false;
  }
}

function isAnimationActionName(value: string): value is AnimationActionName {
  return (DEFAULT_ANIMATION_ACTIONS as string[]).includes(value);
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
