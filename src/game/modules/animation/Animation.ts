import type { Component } from '../../types';

export interface AnimationKeyframe {
  frame: number;
  value: any;
  easing?: string;
}

export interface AnimationTrack {
  property: string;
  interpolation: 'hold' | 'linear';
  valueMode: 'absolute' | 'relative';
  keyframes: AnimationKeyframe[];
}

export interface AnimationLabel {
  name: string;
  duration: number;
  loop: boolean;
  speed: number;
  tracks: AnimationTrack[];
}

export interface AnimationComponent extends Component {
  readonly type: 'Animation';
  labels: AnimationLabel[];
  activeLabel?: string;
  currentFrame: number;
  defaultLabel?: string;
}
