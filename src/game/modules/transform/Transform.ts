import type { Component, EntityId } from '../../types';

export interface TransformComponent extends Component {
  readonly type: 'Transform';
  position: { x: number; y: number; z: number };
  parent?: EntityId;
  rotation: number; // 弧度
  scale: { x: number; y: number; z: number };
}

export const createTransform = (
  x = 0, y = 0, z = 0,
  parent?: EntityId,
  rotation = 0,
  scaleX = 1, scaleY = 1, scaleZ = 1
): TransformComponent => ({
  type: 'Transform',
  position: { x, y, z },
  parent,
  rotation,
  scale: { x: scaleX, y: scaleY, z: scaleZ }
});
