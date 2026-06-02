import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';

type NativeParticle = {
  sprite: Sprite;
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
type EmitterOptions = {
  texture: Texture;
  emissionRate: number;
  originX: number;
  originY: number;
  tintStart: number;
  tintEnd: number;
  sizeStartMin: number;
  sizeStartMax: number;
  sizeEndMin: number;
  sizeEndMax: number;
};

const WIDTH = 1280;
const HEIGHT = 720;
const MAX_PARTICLES = 450;

export function PixiNativeParticlePage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const containerRef = useRef<Container | null>(null);
  const particlesRef = useRef<NativeParticle[]>([]);
  const whiteTextureRef = useRef<Texture | null>(null);
  const faviconTextureRef = useRef<Texture | null>(null);
  const whiteEmitAccumulatorRef = useRef(0);
  const faviconEmitAccumulatorRef = useRef(0);
  const runningRef = useRef(true);
  const [running, setRunning] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const app = new Application();
    appRef.current = app;

    const init = async () => {
      await app.init({
        width: WIDTH,
        height: HEIGHT,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (disposed) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      host.appendChild(app.canvas);
      const particleLayer = new Container();
      containerRef.current = particleLayer;
      app.stage.addChild(particleLayer);

      const [whiteTexture, faviconTexture] = await Promise.all([
        Assets.load<Texture>('/particle_white.svg'),
        Assets.load<Texture>('/favicon.svg'),
      ]);
      whiteTextureRef.current = whiteTexture;
      faviconTextureRef.current = faviconTexture;

      const tick = (ticker: { deltaMS: number }) => {
        if (!runningRef.current) return;
        const deltaTime = Math.min(0.05, Math.max(0.001, ticker.deltaMS / 1000));
        if (whiteTextureRef.current) {
          stepParticles(deltaTime, particleLayer, particlesRef.current, whiteEmitAccumulatorRef, {
            texture: whiteTextureRef.current,
            emissionRate: 90,
            originX: 460,
            originY: HEIGHT * 0.5,
            tintStart: parseHex('#ffb347'),
            tintEnd: parseHex('#ff3b30'),
            sizeStartMin: 8,
            sizeStartMax: 14,
            sizeEndMin: 1.5,
            sizeEndMax: 3,
          });
        }
        if (faviconTextureRef.current) {
          stepParticles(deltaTime, particleLayer, particlesRef.current, faviconEmitAccumulatorRef, {
            texture: faviconTextureRef.current,
            emissionRate: 65,
            originX: 820,
            originY: HEIGHT * 0.5,
            tintStart: 0xffffff,
            tintEnd: 0xffffff,
            sizeStartMin: 3.5,
            sizeStartMax: 6,
            sizeEndMin: 0.8,
            sizeEndMax: 1.6,
          });
        }
        setActiveCount(particlesRef.current.length);
      };

      app.ticker.add(tick);
    };

    void init().catch((error) => {
      console.error('Pixi native particle page init failed:', error);
    });

    return () => {
      disposed = true;
      const appInstance = appRef.current;
      const layer = containerRef.current;
      if (appInstance && layer) {
        appInstance.stage.removeChild(layer);
      }
      for (const particle of particlesRef.current) {
        particle.sprite.destroy();
      }
      particlesRef.current = [];
      containerRef.current = null;
      whiteTextureRef.current = null;
      faviconTextureRef.current = null;
      whiteEmitAccumulatorRef.current = 0;
      faviconEmitAccumulatorRef.current = 0;
      setActiveCount(0);

      if (appInstance?.renderer) {
        appInstance.destroy(true, { children: true, texture: true });
      }
      appRef.current = null;
    };
  }, []);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Pixi Native</p>
        <h1>原生 Pixi 粒子自检页</h1>
        <p className="summary">
          该页面完全绕过 `src/pixiJSRenderer`，直接使用 Pixi 原生 API 绘制粒子。
        </p>
      </section>

      <section className="stage-card">
        <div
          ref={hostRef}
          className="pixi-host"
          style={{ aspectRatio: '1280 / 720', maxWidth: '100%', width: '100%' }}
        />
      </section>

      <section className="controls">
        <div className="control-group">
          <button className="primary" onClick={() => setRunning((value) => !value)}>
            {running ? '暂停' : '继续'}
          </button>
          <button
            className="secondary"
            style={{ marginLeft: '12px' }}
            onClick={() => {
              const layer = containerRef.current;
              if (!layer) return;
              for (const particle of particlesRef.current) {
                layer.removeChild(particle.sprite);
                particle.sprite.destroy();
              }
              particlesRef.current = [];
              whiteEmitAccumulatorRef.current = 0;
              faviconEmitAccumulatorRef.current = 0;
              setActiveCount(0);
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

function stepParticles(
  deltaTime: number,
  layer: Container,
  particles: NativeParticle[],
  emitAccumulatorRef: { current: number },
  options: EmitterOptions,
) {
  emitAccumulatorRef.current += deltaTime * options.emissionRate;
  const spawnCount = Math.floor(emitAccumulatorRef.current);
  emitAccumulatorRef.current -= spawnCount;

  for (let i = 0; i < spawnCount; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const angle = ((-90 + randomRange(-40, 40)) * Math.PI) / 180;
    const speed = randomRange(80, 220);
    const sprite = new Sprite(options.texture);
    sprite.x = options.originX;
    sprite.y = options.originY;
    sprite.anchor.set(0.5, 0.5);
    layer.addChild(sprite);

    particles.push({
      sprite,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime: randomRange(0.5, 1.4),
      sizeStart: randomRange(options.sizeStartMin, options.sizeStartMax),
      sizeEnd: randomRange(options.sizeEndMin, options.sizeEndMax),
      alphaStart: 0.95,
      alphaEnd: 0,
      tintStart: options.tintStart,
      tintEnd: options.tintEnd,
    });
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.age += deltaTime;
    if (particle.age >= particle.lifetime) {
      layer.removeChild(particle.sprite);
      particle.sprite.destroy();
      particles.splice(i, 1);
      continue;
    }

    particle.sprite.x += particle.vx * deltaTime;
    particle.sprite.y += particle.vy * deltaTime;
    const t = Math.min(1, particle.age / particle.lifetime);
    const size = lerp(particle.sizeStart, particle.sizeEnd, t);
    particle.sprite.scale.set(size, size);
    particle.sprite.alpha = lerp(particle.alphaStart, particle.alphaEnd, t);
    particle.sprite.tint = lerpColor(particle.tintStart, particle.tintEnd, t);
  }
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function parseHex(value: string) {
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  return Number.parseInt(normalized, 16) || 0xffffff;
}

function lerpColor(start: number, end: number, t: number) {
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
