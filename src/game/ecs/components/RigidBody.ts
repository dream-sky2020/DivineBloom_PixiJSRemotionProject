import type { Component } from '../../types';

export type BodyType = 'static' | 'dynamic' | 'kinematic';

export interface RigidBodyComponent extends Component {
  readonly type: 'RigidBody';
  bodyType: BodyType;
  mass: number;
  linearVelocity: { x: number; y: number };
  angularVelocity: number;
  fixedRotation: boolean;
  bullet: boolean;
  sensor: boolean;
  gravityScale: number;
  friction: number;
  restitution: number;
  density: number;
}

export const createRigidBody = (
  bodyType: BodyType = 'dynamic',
  options: Partial<Omit<RigidBodyComponent, 'type' | 'bodyType'>> = {}
): RigidBodyComponent => ({
  type: 'RigidBody',
  bodyType,
  mass: options.mass ?? 1,
  linearVelocity: options.linearVelocity ?? { x: 0, y: 0 },
  angularVelocity: options.angularVelocity ?? 0,
  fixedRotation: options.fixedRotation ?? false,
  bullet: options.bullet ?? false,
  sensor: options.sensor ?? false,
  gravityScale: options.gravityScale ?? 1,
  friction: options.friction ?? 0.5,
  restitution: options.restitution ?? 0.2,
  density: options.density ?? 1.0
});
