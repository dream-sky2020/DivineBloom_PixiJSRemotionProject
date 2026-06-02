import { useCallback, useEffect, useRef, useState } from 'react';
import { PixiPhysicsCanvas, type PixiPhysicsRuntime } from '../components/PixiPhysicsCanvas';
import type { PixiTextureSource } from '../pixiJSRenderer/types';

type DebugParticle = {
  id: string;
  renderKind: 'particle' | 'sprite';
  containerId?: string;
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
  isNumber?: boolean;
  numberValue?: number;
};

const FAVICON_PARTICLE_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/favicon.svg',
};
const WHITE_PARTICLE_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/particle_white.svg',
};
const DIGIT_PARTICLE_TEXTURES: PixiTextureSource[] = [
  { kind: 'image', image: '/digit/digit_0.svg' },
  { kind: 'image', image: '/digit/digit_1.svg' },
  { kind: 'image', image: '/digit/digit_2.svg' },
  { kind: 'image', image: '/digit/digit_3.svg' },
  { kind: 'image', image: '/digit/digit_4.svg' },
  { kind: 'image', image: '/digit/digit_5.svg' },
  { kind: 'image', image: '/digit/digit_6.svg' },
  { kind: 'image', image: '/digit/digit_7.svg' },
  { kind: 'image', image: '/digit/digit_8.svg' },
  { kind: 'image', image: '/digit/digit_9.svg' },
];

const WHITE_CONTAINER_ID = 'debug_particle_container_white';
const FAVICON_CONTAINER_ID = 'debug_particle_container_favicon';

export function PixiParticleDebugPage() {
  const runtimeRef = useRef<PixiPhysicsRuntime | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<DebugParticle[]>([]);
  const whiteEmitAccumulatorRef = useRef(0);
  const faviconEmitAccumulatorRef = useRef(0);
  const digitEmitAccumulatorRef = useRef(0);
  const numberCounterRef = useRef(0);
  const sequenceRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  const resetParticles = useCallback(() => {
    particlesRef.current = [];
    whiteEmitAccumulatorRef.current = 0;
    faviconEmitAccumulatorRef.current = 0;
    digitEmitAccumulatorRef.current = 0;
    numberCounterRef.current = 0;
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
          digitEmitAccumulatorRef,
          numberCounterRef,
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
  digitEmitAccumulatorRef: { current: number },
  numberCounterRef: { current: number },
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
  emitNumberParticles(
    particles,
    sequenceRef,
    digitEmitAccumulatorRef,
    numberCounterRef,
    deltaTime,
    20,
    1020,
    390,
    0xffffff,
    0xffffff,
    0.45,
    0.7,
    0.2,
    0.35,
  );

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += deltaTime;
    if (p.age >= p.lifetime) {
      particles.splice(i, 1);
      continue;
    }

    const t = Math.min(1, p.age / p.lifetime);

    if (p.isNumber) {
      // 1. 移动：开始移动很快，但是后面就快速变慢最后数字不再移动
      const stopProgress = 0.4;
      if (t < stopProgress) {
        const speedFactor = Math.pow(1 - t / stopProgress, 2);
        p.x += p.vx * speedFactor * deltaTime;
        p.y += p.vy * speedFactor * deltaTime;
      }
    } else {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
    }
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
    if (p.renderKind === 'particle') {
      runtime.reconciler.setObject({
        id: p.id,
        kind: 'particle',
        containerId: p.containerId ?? WHITE_CONTAINER_ID,
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
    } else {
      let scaleX = lerp(p.sizeStart, p.sizeEnd, t);
      let scaleY = lerp(p.sizeStart, p.sizeEnd, t);
      let alpha = lerp(p.alphaStart, p.alphaEnd, t);

      if (p.isNumber) {
        // 2. 大小：在 50% 的生命周期内增长到最大
        const sizeT = Math.min(1, t / 0.5);
        const size = lerp(p.sizeStart, p.sizeEnd, sizeT);
        scaleX = size;
        scaleY = size;

        // 3. 渐变消失：在 80% 生命周期后才开始渐变消失，中间留出 50%-80% 的完全静止停留时间
        if (t > 0.8) {
          const alphaT = (t - 0.8) / 0.2;
          alpha = lerp(1, 0, alphaT);
        } else {
          alpha = 1;
        }
      }

      runtime.reconciler.setObject({
        id: p.id,
        kind: 'sprite',
        props: {
          texture: p.texture,
          x: p.x,
          y: p.y,
          scaleX,
          scaleY,
          alpha,
          tint: lerpColor(p.tintStart, p.tintEnd, t),
          anchorX: 0.5,
          anchorY: 0.5,
          visible: true,
          blendMode: 'normal',
        },
      });
    }
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
      renderKind: 'particle',
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

function emitNumberParticles(
  particles: DebugParticle[],
  sequenceRef: { current: number },
  emitAccumulatorRef: { current: number },
  numberCounterRef: { current: number },
  deltaTime: number,
  emissionRate: number,
  originX: number,
  originY: number,
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
    const numberValue = numberCounterRef.current;
    const digits = String(numberValue).split('');
    numberCounterRef.current = (numberCounterRef.current + 1) % 1000;
    const angle = ((-90 + randomRange(-35, 35)) * Math.PI) / 180;

    // 开始移动很快
    const speed = randomRange(600, 1000);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const lifetime = randomRange(2.5, 3.5);

    // 数字越大，数字最后的大小也越大
    // 基础缩放从 1.2 开始，最大到 2.8，确保即使是数字 0 也有足够的体积感
    const scaleFactor = 1.2 + (numberValue / 999) * 1.6;
    const sizeEnd = sizeEndMax * scaleFactor;
    // 初始大小也稍微调大一点，从最终大小的 40% 开始增长
    const sizeStart = sizeEnd * 0.4;

    for (let digitIndex = 0; digitIndex < digits.length; digitIndex++) {
      if (particles.length >= 600) return;
      const digit = Number.parseInt(digits[digitIndex] ?? '0', 10);
      const texture = DIGIT_PARTICLE_TEXTURES[digit];
      if (!texture) continue;

      // 根据缩放调整间距，将 14 调小可以让数字更靠近
      const digitOffset = (digitIndex - (digits.length - 1) / 2) * (10 * scaleFactor);
      particles.push({
        id: `debug_particle_${sequenceRef.current++}`,
        renderKind: 'sprite',
        texture,
        x: originX + digitOffset,
        y: originY,
        vx,
        vy,
        age: 0,
        lifetime,
        sizeStart,
        sizeEnd,
        alphaStart: 1,
        alphaEnd: 0,
        tintStart,
        tintEnd,
        isNumber: true,
        numberValue,
      });
    }
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
