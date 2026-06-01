import type { Component } from '../../types';

export interface CameraComponent extends Component {
  readonly type: 'Camera';
  /** 摄像机 X 轴偏移（平移 world 容器） */
  x: number;
  /** 摄像机 Y 轴偏移 */
  y: number;
  /** 摄像机 Z 轴偏移（推进/拉远，伪 3D） */
  z: number;
  /** 焦点距离，控制伪 3D 投影强度；<= 0 时禁用 setPlanes */
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
