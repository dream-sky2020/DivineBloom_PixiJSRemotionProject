import type { Component } from '../../types';

export interface TimerComponent extends Component {
  readonly type: 'Timer';
  time: number;
  duration: number;
  loop: boolean;
  active: boolean;
  onCompleteSignal?: string;
}
