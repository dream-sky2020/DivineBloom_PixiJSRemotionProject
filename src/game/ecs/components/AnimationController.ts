import type { Component } from '../../types';

export type AnimationDirection = 'forward' | 'backward';

export interface AnimationControllerComponent extends Component {
  readonly type: 'AnimationController';
  playing: boolean;
  currentLabel?: string;
  localFrame: number;
  speedScale: number;
  direction: AnimationDirection;
  loopOverride?: boolean;
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
});
