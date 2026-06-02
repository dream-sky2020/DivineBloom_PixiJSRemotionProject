import type { Component } from '../../types';
import type { PixiGraphicObjectKind, PixiTextureSource } from '../../../pixiJSRenderer/types';

export interface ParticleEmitterComponent extends Component {
  readonly type: 'ParticleEmitter';
  maxParticles: number;
  emissionRate: number;
  texture?: PixiTextureSource;
  graphicKind?: Extract<PixiGraphicObjectKind, 'circleGraphic' | 'squareGraphic'>;
  lifetimeMin: number;
  lifetimeMax: number;
  speedMin: number;
  speedMax: number;
  angle: number; // 度
  spread: number; // 度
  startColor: string | number;
  endColor: string | number;
  startSize: number;
  endSize: number;
  startAlpha: number;
  endAlpha: number;
  blendMode: 'none' | 'normal' | 'add' | 'multiply' | 'subtract' | 'screen';
  anchor: { x: number; y: number };
}

export interface ParticleData {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  startColor: number;
  endColor: number;
  startSize: number;
  endSize: number;
  startAlpha: number;
  endAlpha: number;
  rotation: number;
  angularVelocity: number;
}
