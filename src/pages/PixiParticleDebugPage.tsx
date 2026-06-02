import { useCallback, useEffect, useRef, useState } from 'react';
import { PixiPhysicsCanvas, type PixiPhysicsRuntime } from '../components/PixiPhysicsCanvas';
import type { PixiTextureSource } from '../pixiJSRenderer/types';

type DebugParticle = {
  id: string;
  containerId: string;
  texture: PixiTextureSource;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  sizeStart: number;
  sizeEnd: number;
  alphaStart: number;
  alphaEnd: number;
  tintStart: number;
  tintEnd: number;
};

const FAVICON_PARTICLE_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/favicon.svg',
};
const WHITE_PARTICLE_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/particle_white.svg',
};

const WHITE_CONTAINER_ID = 'debug_particle_container_white';
const FAVICON_CONTAINER_ID = 'debug_particle_container_favicon';

export function PixiParticleDebugPage() {
  const runtimeRef = useRef<PixiPhysicsRuntime | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<DebugParticle[]>([]);
  const whiteEmitAccumulatorRef = useRef(0);
  const faviconEmitAccumulatorRef = useRef(0);
  const sequenceRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  const resetParticles = useCallback(() => {
    particlesRef.current = [];
    whiteEmitAccumulatorRef.current = 0;
    faviconEmitAccumulatorRef.current = 0;
    sequenceRef.current = 0;
    setActiveCount(0);
  }, []);

  const handleRuntimeReady = useCallback((runtime: PixiPhysicsRuntime) => {
    runtimeRef.current = runtime;
    resetParticles();
    runtime.processor.clear();
  }, [resetParticles]);

  const handleRuntimeDestroy = useCallback(() => {
    runtimeRef.current = null;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    const tick = (time: number) => {
      const runtime = runtimeRef.current;
      if (runtime && running) {
        const deltaTime = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 1 / 60;
        lastTimeRef.current = time;
        updateParticles(
          runtime,
          Math.min(0.05, Math.max(0.001, deltaTime)),
          particlesRef.current,
          whiteEmitAccumulatorRef,
          faviconEmitAccumulatorRef,
          sequenceRef,
        );
        setActiveCount(particlesRef.current.length);
      } else {
        lastTimeRef.current = time;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running]);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Pixi Renderer</p>
        <h1>粒子渲染自检页</h1>
        <p className="summary">
          该页面不经过 ECS，直接使用 `PixiFrameReconciler + PixiCommandProcessor` 驱动粒子。
        </p>
      </section>

      <section className="stage-card">
        <div className="pixi-host" style={{ aspectRatio: '1280 / 720', maxWidth: '100%', width: '100%' }}>
          <PixiPhysicsCanvas
            width={1280}
            height={720}
            onReady={handleRuntimeReady}
            onDestroy={handleRuntimeDestroy}
          />
        </div>
      </section>

      <section className="controls">
        <div className="control-group">
          <button className="primary" onClick={() => setRunning((v) => !v)}>
            {running ? '暂停' : '继续'}
          </button>
          <button
            className="secondary"
            style={{ marginLeft: '12px' }}
            onClick={() => {
              resetParticles();
              runtimeRef.current?.processor.clear();
            }}
          >
            清空并重置
          </button>
        </div>
      </section>

      <p className="status">当前活跃粒子: {activeCount}</p>
    </div>
  );
}

function updateParticles(
  runtime: PixiPhysicsRuntime,
  deltaTime: number,
  particles: DebugParticle[],
  whiteEmitAccumulatorRef: { current: number },
  faviconEmitAccumulatorRef: { current: number },
  sequenceRef: { current: number },
) {
  emitParticles(
    particles,
    sequenceRef,
    whiteEmitAccumulatorRef,
    deltaTime,
    90,
    460,
    360,
    WHITE_CONTAINER_ID,
    WHITE_PARTICLE_TEXTURE,
    parseHex('#ffb347'),
    parseHex('#ff3b30'),
    8,
    14,
    1.5,
    3,
  );
  emitParticles(
    particles,
    sequenceRef,
    faviconEmitAccumulatorRef,
    deltaTime,
    65,
    640,
    360,
    FAVICON_CONTAINER_ID,
    FAVICON_PARTICLE_TEXTURE,
    0xffffff,
    0xffffff,
    3.5,
    6,
    0.8,
    1.6,
  );

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += deltaTime;
    if (p.age >= p.lifetime) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * deltaTime;
    p.y += p.vy * deltaTime;
  }

  runtime.reconciler.beginFrame();
  runtime.reconciler.setObject({
    id: WHITE_CONTAINER_ID,
    kind: 'particleContainer',
    props: { blendMode: 'add', visible: true },
  });
  runtime.reconciler.setObject({
    id: FAVICON_CONTAINER_ID,
    kind: 'particleContainer',
    props: { blendMode: 'normal', visible: true },
  });

  for (const p of particles) {
    const t = Math.min(1, p.age / p.lifetime);
    runtime.reconciler.setObject({
      id: p.id,
      kind: 'particle',
      containerId: p.containerId,
      props: {
        texture: p.texture,
        x: p.x,
        y: p.y,
        scaleX: lerp(p.sizeStart, p.sizeEnd, t),
        scaleY: lerp(p.sizeStart, p.sizeEnd, t),
        alpha: lerp(p.alphaStart, p.alphaEnd, t),
        tint: lerpColor(p.tintStart, p.tintEnd, t),
        anchorX: 0.5,
        anchorY: 0.5,
      },
    });
  }

  const commands = runtime.reconciler.reconcile();
  runtime.processor.processCommands(commands);
}

function emitParticles(
  particles: DebugParticle[],
  sequenceRef: { current: number },
  emitAccumulatorRef: { current: number },
  deltaTime: number,
  emissionRate: number,
  originX: number,
  originY: number,
  containerId: string,
  texture: PixiTextureSource,
  tintStart: number,
  tintEnd: number,
  sizeStartMin: number,
  sizeStartMax: number,
  sizeEndMin: number,
  sizeEndMax: number,
) {
  emitAccumulatorRef.current += deltaTime * emissionRate;
  const spawnCount = Math.floor(emitAccumulatorRef.current);
  emitAccumulatorRef.current -= spawnCount;

  for (let i = 0; i < spawnCount; i++) {
    if (particles.length >= 600) break;
    const angle = ((-90 + randomRange(-40, 40)) * Math.PI) / 180;
    const speed = randomRange(80, 220);
    particles.push({
      id: `debug_particle_${sequenceRef.current++}`,
      containerId,
      texture,
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime: randomRange(0.5, 1.4),
      sizeStart: randomRange(sizeStartMin, sizeStartMax),
      sizeEnd: randomRange(sizeEndMin, sizeEndMax),
      alphaStart: 0.95,
      alphaEnd: 0,
      tintStart,
      tintEnd,
    });
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function parseHex(color: string): number {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
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
