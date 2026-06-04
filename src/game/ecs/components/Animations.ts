import type { Component } from '../../types';

export type AnimationInterpolation = 'hold' | 'linear';
export type AnimationValueMode = 'absolute' | 'relative';

export type AnimationKeyValue = number | string | boolean;

export type AnimationKeyEventPhase = 'enter' | 'leave' | 'exact';
export type AnimationKeyEventDirection = 'both' | 'forward' | 'backward';

export interface AnimationPayloadSet {
  key: string;
  from?: string;
  value?: AnimationKeyValue;
}

export interface AnimationKeyEvent {
  signal: string;
  once: boolean;
  phase: AnimationKeyEventPhase;
  direction: AnimationKeyEventDirection;
  fireOnSeek: boolean;
  cooldownMs: number;
  sets: AnimationPayloadSet[];
}

export interface AnimationKeyframe {
  frame: number;
  value: AnimationKeyValue;
  easing?: string;
  events?: AnimationKeyEvent[];
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
