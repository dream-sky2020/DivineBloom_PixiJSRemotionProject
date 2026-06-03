import type { Component } from '../../types';

export type AnimationInterpolation = 'hold' | 'linear';
export type AnimationValueMode = 'absolute' | 'relative';

export type AnimationKeyValue = number | string | boolean;

export interface AnimationKeyframe {
  frame: number;
  value: AnimationKeyValue;
  easing?: string;
}

export interface AnimationTrack {
  prop: string;
  interpolation: AnimationInterpolation;
  valueMode: AnimationValueMode;
  keys: AnimationKeyframe[];
}

export interface AnimationLabel {
  name: string;
  duration: number;
  loop: boolean;
  speed: number;
  tracks: AnimationTrack[];
}

export interface AnimationsComponent extends Component {
  readonly type: 'Animations';
  defaultLabel?: string;
  labels: Record<string, AnimationLabel>;
}

export const createAnimations = (
  labels: Record<string, AnimationLabel>,
  defaultLabel?: string,
): AnimationsComponent => ({
  type: 'Animations',
  defaultLabel,
  labels,
});
