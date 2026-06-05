import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector2 } from '@sence/type/base/Vector';

// 4.9 粒子发射器组件 (ParticleEmitter) [cite: 24, 25, 26, 27, 28]
export class ParticleEmitterComponent implements IComponent {
    readonly type = 'ParticleEmitter';
    maxParticles: number = 200;
    emissionRate: number = 30;
    texture?: string;
    graphicKind?: string;
    lifetimeMin?: number;
    lifetimeMax?: number;
    speedMin?: number;
    speedMax?: number;
    angle?: number;
    spread?: number;
    startColor?: string;
    endColor?: string;
    startSize?: number;
    endSize?: number;
    startAlpha?: number;
    endAlpha?: number;
    blendMode?: string;
    anchor?: Vector2;
}
