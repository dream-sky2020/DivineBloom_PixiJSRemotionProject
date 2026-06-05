import type { Component } from '../../types';

export interface CameraComponent extends Component {
  readonly type: 'Camera';
  x: number;
  y: number;
  z: number;
  focus: number;
}

export const createCamera = (
  options: Partial<Omit<CameraComponent, 'type'>> = {}
): CameraComponent => ({
  type: 'Camera',
  x: options.x ?? 0,
  y: options.y ?? 0,
  z: options.z ?? 0,
  focus: options.focus ?? 400,
});
