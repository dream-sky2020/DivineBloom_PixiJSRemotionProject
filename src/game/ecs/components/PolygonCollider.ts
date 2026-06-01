import type { Component } from '../../types';

export interface PolygonColliderComponent extends Component {
  readonly type: 'PolygonCollider';
  points: { x: number; y: number }[];
}

export const createPolygonCollider = (
  points: { x: number; y: number }[]
): PolygonColliderComponent => ({
  type: 'PolygonCollider',
  points
});
