import { System } from '../../types';
import type { Entity, TransformComponent, WorldData, CameraComponent } from '../../types';
import type { PixiTextureSource } from '../../../pixiJSRenderer/types';
import { PixiFrameReconciler } from '../../../pixiJSRenderer/PixiFrameReconciler';
import { PixiCommandProcessor } from '../../../pixiJSRenderer/PixiCommandProcessor';
import type { ParticleData, ParticleEmitterComponent } from './ParticleEmitter';
import { createEntityMap, resolveWorldTransform, type TransformCache } from '../transform/transformHierarchy';

interface EmitterRuntimeState {
  emitAccumulator: number;
  sequence: number;
  particles: ParticleData[];
  activeCount: number;
}

const WHITE_PIXEL_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/particle_white.svg',
};

export class EcsParticleSystem extends System {
  private readonly reconciler = new PixiFrameReconciler();
  private readonly processor: PixiCommandProcessor;
  private readonly emitterState = new Map<string, EmitterRuntimeState>();
  private worldData?: WorldData;

  constructor(processor: PixiCommandProcessor) {
    super();
    this.processor = processor;
  }

  bindWorldData(worldData: WorldData): void {
    this.worldData = worldData;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.reconciler.beginFrame();

    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();
    const activeEmitterIds = new Set<string>();
    const cameraEntity = entities.find((e) => e.components.has('Camera'));
    const camera = cameraEntity?.components.get('Camera') as CameraComponent | undefined;
    const canvas = this.worldData?.canvas;
    const activeBatchKeys = new Set<string>();

    for (const entity of entities) {
      const emitter = entity.components.get('ParticleEmitter') as ParticleEmitterComponent | undefined;
      const transform = entity.components.get('Transform') as TransformComponent | undefined;
      if (!emitter || !transform) continue;

      const emitterId = String(entity.id);
      activeEmitterIds.add(emitterId);

      const worldTransform = resolveWorldTransform(entity, entityMap, transformCache);
      if (!worldTransform) continue;

      if (camera && canvas) {
        const margin = 200;
        const screenX = worldTransform.position.x - camera.x;
        const screenY = worldTransform.position.y - camera.y;
        if (
          screenX < -margin ||
          screenX > canvas.width + margin ||
          screenY < -margin ||
          screenY > canvas.height + margin
        ) {
          const runtime = this.getOrCreateRuntime(emitterId, emitter.maxParticles);
          this.stepEmitter(runtime, emitterId, emitter, worldTransform.position.x, worldTransform.position.y, deltaTime);
          continue;
        }
      }

      const textureSource = emitter.texture || (emitter.graphicKind ? WHITE_PIXEL_TEXTURE : undefined);
      const textureKey = textureSource ?
        (textureSource.kind === 'image' ? textureSource.image : `${textureSource.atlas}:${textureSource.atlasFrame}`)
        : (emitter.graphicKind || 'default');
      const batchKey = `${textureKey}_${emitter.blendMode}`;
      const sharedContainerId = `global_batch_${batchKey}`;

      if (!activeBatchKeys.has(batchKey)) {
        activeBatchKeys.add(batchKey);
        this.reconciler.setObject({
          id: sharedContainerId,
          kind: 'particleContainer',
          props: {
            blendMode: emitter.blendMode,
            visible: true,
          },
        });
      }

      const runtime = this.getOrCreateRuntime(emitterId, emitter.maxParticles);
      this.stepEmitter(runtime, emitterId, emitter, worldTransform.position.x, worldTransform.position.y, deltaTime);

      for (let i = 0; i < runtime.activeCount; i++) {
        const particle = runtime.particles[i];
        const t = Math.min(1, particle.age / particle.lifetime);
        this.reconciler.setObject({
          id: particle.id,
          kind: 'particle',
          containerId: sharedContainerId,
          props: {
            texture: textureSource,
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
    let i = 0;
    while (i < runtime.activeCount) {
      const particle = runtime.particles[i];
      particle.age += deltaTime;

      if (particle.age >= particle.lifetime) {
        const lastIndex = runtime.activeCount - 1;
        if (i < lastIndex) {
          const lastParticle = runtime.particles[lastIndex];
          runtime.particles[lastIndex] = particle;
          runtime.particles[i] = lastParticle;
        }
        runtime.activeCount--;
      } else {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.rotation += particle.angularVelocity * deltaTime;
        i++;
      }
    }

    runtime.emitAccumulator += Math.max(0, deltaTime) * Math.max(0, emitter.emissionRate);
    const canSpawn = Math.max(0, emitter.maxParticles - runtime.activeCount);
    const spawnCount = Math.min(canSpawn, Math.floor(runtime.emitAccumulator));
    runtime.emitAccumulator -= spawnCount;

    for (let j = 0; j < spawnCount; j++) {
      const angleDeg = emitter.angle + randomRange(-emitter.spread * 0.5, emitter.spread * 0.5);
      const angleRad = (angleDeg * Math.PI) / 180;
      const speed = randomRange(emitter.speedMin, emitter.speedMax);

      const particle = runtime.particles[runtime.activeCount];
      particle.id = `particle_${emitterId}_${runtime.sequence++}`;
      particle.x = originX;
      particle.y = originY;
      particle.vx = Math.cos(angleRad) * speed;
      particle.vy = Math.sin(angleRad) * speed;
      particle.age = 0;
      particle.lifetime = Math.max(0.001, randomRange(emitter.lifetimeMin, emitter.lifetimeMax));
      particle.startColor = parseHexColor(emitter.startColor);
      particle.endColor = parseHexColor(emitter.endColor);
      particle.startSize = emitter.startSize;
      particle.endSize = emitter.endSize;
      particle.startAlpha = emitter.startAlpha;
      particle.endAlpha = emitter.endAlpha;
      particle.rotation = angleRad;
      particle.angularVelocity = randomRange(-2.2, 2.2);

      runtime.activeCount++;
    }
  }

  private getOrCreateRuntime(emitterId: string, maxParticles: number): EmitterRuntimeState {
    const existing = this.emitterState.get(emitterId);
    if (existing) {
      if (existing.particles.length < maxParticles) {
        const extra = maxParticles - existing.particles.length;
        for (let i = 0; i < extra; i++) {
          existing.particles.push({} as ParticleData);
        }
      }
      return existing;
    }
    const created: EmitterRuntimeState = {
      emitAccumulator: 0,
      sequence: 0,
      particles: Array.from({ length: maxParticles }, () => ({} as ParticleData)),
      activeCount: 0,
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
