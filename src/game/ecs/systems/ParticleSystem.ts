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
  
  // 运行时状态：每个发射器私有的数据（如发射累加器）
  private readonly emitterState = new Map<string, EmitterRuntimeState>();
  
  // 粒子池：全局复用粒子对象，减少 GC
  private readonly particlePool: ParticleData[] = [];
  private readonly MAX_POOL_SIZE = 5000;

  constructor(processor: PixiCommandProcessor) {
    super();
    this.processor = processor;
  }

  update(entities: Entity[], deltaTime: number): void {
    this.reconciler.beginFrame();

    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();
    const activeEmitterIds = new Set<string>();
    
    // 批处理容器管理：Key 为 "texture|blendMode"
    const activeBatchKeys = new Set<string>();

    for (const entity of entities) {
      const emitter = entity.components.get('ParticleEmitter') as ParticleEmitterComponent | undefined;
      const transform = entity.components.get('Transform') as TransformComponent | undefined;
      if (!emitter || !transform) continue;

      const emitterId = String(entity.id);
      activeEmitterIds.add(emitterId);

      const worldTransform = resolveWorldTransform(entity, entityMap, transformCache);
      if (!worldTransform) continue;

      // 1. 确定批处理 Key
      const texture = emitter.texture || (emitter.graphicKind ? WHITE_PIXEL_TEXTURE : undefined);
      const textureUrl = texture?.kind === 'image' ? texture.image : 'default';
      const batchKey = `${textureUrl}|${emitter.blendMode}`;
      activeBatchKeys.add(batchKey);

      // 2. 确保对应的全局容器存在
      this.reconciler.setObject({
        id: `global_particle_container_${batchKey}`,
        kind: 'particleContainer',
        props: {
          blendMode: emitter.blendMode,
          visible: true,
        },
      });

      // 3. 更新发射器逻辑
      const runtime = this.getOrCreateRuntime(emitterId);
      this.stepEmitter(runtime, emitterId, emitter, worldTransform.position.x, worldTransform.position.y, deltaTime);

      // 4. 提交粒子渲染指令，挂载到全局共享容器下
      for (const particle of runtime.particles) {
        const t = Math.min(1, particle.age / particle.lifetime);
        this.reconciler.setObject({
          id: particle.id,
          kind: 'particle',
          containerId: `global_particle_container_${batchKey}`,
          props: {
            texture: texture,
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

    // 清理已失效的发射器状态
    for (const emitterId of [...this.emitterState.keys()]) {
      if (!activeEmitterIds.has(emitterId)) {
        const runtime = this.emitterState.get(emitterId);
        if (runtime) {
          // 将失效发射器的粒子回收到池中
          this.recycleParticles(runtime.particles);
        }
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
    // 1. 更新现有粒子并回收死亡粒子
    for (let i = runtime.particles.length - 1; i >= 0; i--) {
      const particle = runtime.particles[i];
      particle.age += deltaTime;
      
      if (particle.age >= particle.lifetime) {
        // 死亡粒子：从发射器列表中移除并回收到池
        const deadParticle = runtime.particles.splice(i, 1)[0];
        this.recycleParticle(deadParticle);
        continue;
      }
      
      // 物理更新
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.rotation += particle.angularVelocity * deltaTime;
    }

    // 2. 生成新粒子
    runtime.emitAccumulator += Math.max(0, deltaTime) * Math.max(0, emitter.emissionRate);
    const canSpawn = Math.max(0, emitter.maxParticles - runtime.particles.length);
    const spawnCount = Math.min(canSpawn, Math.floor(runtime.emitAccumulator));
    runtime.emitAccumulator -= spawnCount;

    for (let i = 0; i < spawnCount; i++) {
      const angleDeg = emitter.angle + randomRange(-emitter.spread * 0.5, emitter.spread * 0.5);
      const angleRad = (angleDeg * Math.PI) / 180;
      const speed = randomRange(emitter.speedMin, emitter.speedMax);
      
      // 从池中获取或创建新粒子
      const particle = this.spawnParticle();
      
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
      
      runtime.particles.push(particle);
    }
  }

  private spawnParticle(): ParticleData {
    return this.particlePool.pop() || {
      id: '', x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 0,
      startColor: 0, endColor: 0, startSize: 0, endSize: 0,
      startAlpha: 0, endAlpha: 0, rotation: 0, angularVelocity: 0
    };
  }

  private recycleParticle(particle: ParticleData): void {
    if (this.particlePool.length < this.MAX_POOL_SIZE) {
      this.particlePool.push(particle);
    }
  }

  private recycleParticles(particles: ParticleData[]): void {
    for (const p of particles) {
      this.recycleParticle(p);
    }
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
