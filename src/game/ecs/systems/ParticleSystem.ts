import { System } from '../../types';
import type { Entity, TransformComponent } from '../../types';
import type { PixiTextureSource } from '../../../pixiJSRenderer/types';
import { PixiFrameReconciler } from '../../../pixiJSRenderer/PixiFrameReconciler';
import { PixiCommandProcessor } from '../../../pixiJSRenderer/PixiCommandProcessor';
import type { ParticleData, ParticleEmitterComponent } from '../components/ParticleEmitter';
import { createEntityMap, resolveWorldTransform, type TransformCache } from '../utils/transformHierarchy';

interface EmitterRuntimeState {
  emitAccumulator: number;
  sequence: number;
  particles: ParticleData[];
}

const WHITE_PIXEL_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/particle_white.svg',
};

export class EcsParticleSystem extends System {
  private readonly reconciler = new PixiFrameReconciler();
  private readonly processor: PixiCommandProcessor;
  private readonly emitterState = new Map<string, EmitterRuntimeState>();

  constructor(processor: PixiCommandProcessor) {
    super();
    this.processor = processor;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.reconciler.beginFrame();

    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();
    const activeEmitterIds = new Set<string>();

    for (const entity of entities) {
      const emitter = entity.components.get('ParticleEmitter') as ParticleEmitterComponent | undefined;
      const transform = entity.components.get('Transform') as TransformComponent | undefined;
      if (!emitter || !transform) continue;

      const emitterId = String(entity.id);
      activeEmitterIds.add(emitterId);

      const worldTransform = resolveWorldTransform(entity, entityMap, transformCache);
      if (!worldTransform) continue;

      this.reconciler.setObject({
        id: this.getContainerId(emitterId),
        kind: 'particleContainer',
        props: {
          blendMode: emitter.blendMode,
          visible: true,
        },
      });

      const runtime = this.getOrCreateRuntime(emitterId);
      this.stepEmitter(runtime, emitterId, emitter, worldTransform.position.x, worldTransform.position.y, deltaTime);

      // ParticleData[] 批处理：统一遍历数组并提交 particle 状态。
      for (const particle of runtime.particles) {
        const t = Math.min(1, particle.age / particle.lifetime);
        this.reconciler.setObject({
          id: particle.id,
          kind: 'particle',
          containerId: this.getContainerId(emitterId),
          props: {
            texture: emitter.texture || (emitter.graphicKind ? WHITE_PIXEL_TEXTURE : undefined),
            x: particle.x,
            y: particle.y,
            scaleX: lerp(particle.startSize, particle.endSize, t),
            scaleY: lerp(particle.startSize, particle.endSize, t),
            alpha: lerp(particle.startAlpha, particle.endAlpha, t),
            tint: lerpColor(particle.startColor, particle.endColor, t),
            rotation: particle.rotation,
            anchorX: emitter.anchor.x,
            anchorY: emitter.anchor.y,
          },
        });
      }
    }

    for (const emitterId of [...this.emitterState.keys()]) {
      if (!activeEmitterIds.has(emitterId)) {
        this.emitterState.delete(emitterId);
      }
    }

    const commands = this.reconciler.reconcile();
    this.processor.processCommands(commands);
  }

  private stepEmitter(
    runtime: EmitterRuntimeState,
    emitterId: string,
    emitter: ParticleEmitterComponent,
    originX: number,
    originY: number,
    deltaTime: number,
  ): void {
    runtime.emitAccumulator += Math.max(0, deltaTime) * Math.max(0, emitter.emissionRate);
    const canSpawn = Math.max(0, emitter.maxParticles - runtime.particles.length);
    const spawnCount = Math.min(canSpawn, Math.floor(runtime.emitAccumulator));
    runtime.emitAccumulator -= spawnCount;

    for (let i = 0; i < spawnCount; i++) {
      const angleDeg = emitter.angle + randomRange(-emitter.spread * 0.5, emitter.spread * 0.5);
      const angleRad = (angleDeg * Math.PI) / 180;
      const speed = randomRange(emitter.speedMin, emitter.speedMax);
      runtime.particles.push({
        id: `particle_${emitterId}_${runtime.sequence++}`,
        x: originX,
        y: originY,
        vx: Math.cos(angleRad) * speed,
        vy: Math.sin(angleRad) * speed,
        age: 0,
        lifetime: Math.max(0.001, randomRange(emitter.lifetimeMin, emitter.lifetimeMax)),
        startColor: parseHexColor(emitter.startColor),
        endColor: parseHexColor(emitter.endColor),
        startSize: emitter.startSize,
        endSize: emitter.endSize,
        startAlpha: emitter.startAlpha,
        endAlpha: emitter.endAlpha,
        rotation: angleRad,
        angularVelocity: randomRange(-2.2, 2.2),
      });
    }

    runtime.particles = runtime.particles.filter((particle) => {
      particle.age += deltaTime;
      if (particle.age >= particle.lifetime) {
        return false;
      }
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.rotation += particle.angularVelocity * deltaTime;
      return true;
    });
  }

  private getContainerId(emitterId: string): string {
    return `particle_container_${emitterId}`;
  }

  private getOrCreateRuntime(emitterId: string): EmitterRuntimeState {
    const existing = this.emitterState.get(emitterId);
    if (existing) return existing;
    const created: EmitterRuntimeState = {
      emitAccumulator: 0,
      sequence: 0,
      particles: [],
    };
    this.emitterState.set(emitterId, created);
    return created;
  }
}

function randomRange(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.random() * (hi - lo);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function parseHexColor(value: string | number): number {
  if (typeof value === 'number') return value;
  const normalized = value.startsWith('#') ? `0x${value.slice(1)}` : value.startsWith('0x') ? value : `0x${value}`;
  return Number.parseInt(normalized, 16) || 0xffffff;
}

function lerpColor(start: number, end: number, t: number): number {
  const sr = (start >> 16) & 0xff;
  const sg = (start >> 8) & 0xff;
  const sb = start & 0xff;
  const er = (end >> 16) & 0xff;
  const eg = (end >> 8) & 0xff;
  const eb = end & 0xff;
  const r = Math.round(lerp(sr, er, t));
  const g = Math.round(lerp(sg, eg, t));
  const b = Math.round(lerp(sb, eb, t));
  return (r << 16) | (g << 8) | b;
}
