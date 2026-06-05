import type { Component } from '../../types';

export interface CircleColliderComponent extends Component {
  readonly type: 'CircleCollider';
  radius: number;
  offset: { x: number; y: number };
}

export const createCircleCollider = (
  radius: number,
  offsetX = 0,
  offsetY = 0
): CircleColliderComponent => ({
  type: 'CircleCollider',
  radius,
  offset: { x: offsetX, y: offsetY }
});

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
