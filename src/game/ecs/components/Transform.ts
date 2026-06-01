import type { Component } from '../../types';

export interface TransformComponent extends Component {
  readonly type: 'Transform';
  position: { x: number; y: number; z: number };
  rotation: number; // 弧度
  scale: { x: number; y: number; z: number };
}

export const createTransform = (
  x = 0, y = 0, z = 0,
  rotation = 0,
  scaleX = 1, scaleY = 1, scaleZ = 1
): TransformComponent => ({
  type: 'Transform',
  position: { x, y, z },
  rotation,
  scale: { x: scaleX, y: scaleY, z: scaleZ }
});
