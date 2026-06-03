import { useCallback, useEffect, useRef, useState } from 'react';
import { PixiPhysicsCanvas, type PixiPhysicsRuntime } from '../components/PixiPhysicsCanvas';
import type { PixiTextureSource } from '../pixiJSRenderer/types';

const WIDTH = 1280;
const HEIGHT = 720;
const NODE_COLUMNS = 4;

const HEPTAGON_TEXTURE: PixiTextureSource = {
  kind: 'image',
  image: '/heptagon_45.svg',
};

type DepthNodeLayout = {
  id: string;
  x: number;
  y: number;
  isFront: boolean;
  index: number;
};

type BattlePalette = {
  darkNavy: number;
  darkSlate: number;
  cyan: number;
  blue: number;
  whiteBlue: number;
  paleBlue: number;
  darkerNavy: number;
  yellow: number;
  grayBlue: number;
};

export function PixiParticleDebugPage() {
  const runtimeRef = useRef<PixiPhysicsRuntime | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const paletteRef = useRef<BattlePalette>(resolveBattlePalette());
  const runningRef = useRef(true);
  const [running, setRunning] = useState(true);

  const handleRuntimeReady = useCallback((runtime: PixiPhysicsRuntime) => {
    runtimeRef.current = runtime;
    runtime.processor.clear();
  }, []);

  const handleRuntimeDestroy = useCallback(() => {
    runtimeRef.current = null;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const tick = (time: number) => {
      const runtime = runtimeRef.current;
      if (runtime) {
        const deltaTime = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 1 / 60;
        lastTimeRef.current = time;

        if (runningRef.current) {
          elapsedRef.current += Math.min(0.05, Math.max(0.001, deltaTime));
        }

        renderBattleCoreFrame(runtime, elapsedRef.current, paletteRef.current);
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
  }, []);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Pixi Renderer</p>
        <h1>核心战斗 UI 外观（Reconciler 版）</h1>
        <p className="summary">
          使用 `PixiFrameReconciler + PixiCommandProcessor` 渲染两排节点，模拟前后景深层。
        </p>
      </section>

      <section className="stage-card">
        <div className="pixi-host" style={{ aspectRatio: '1280 / 720', maxWidth: '100%', width: '100%' }}>
          <PixiPhysicsCanvas
            width={WIDTH}
            height={HEIGHT}
            onReady={handleRuntimeReady}
            onDestroy={handleRuntimeDestroy}
          />
        </div>
      </section>

      <section className="controls">
        <div className="control-group">
          <button className="primary" onClick={() => setRunning((value) => !value)}>
            {running ? '暂停动效' : '继续动效'}
          </button>
        </div>
      </section>

      <p className="status">节点总数: 8（前排 4 / 后排 4）</p>
    </div>
  );
}

function renderBattleCoreFrame(runtime: PixiPhysicsRuntime, elapsed: number, palette: BattlePalette) {
  runtime.reconciler.beginFrame();

  runtime.reconciler.setObject({
    id: 'battle-ui-bg',
    kind: 'rectangleGraphic',
    props: {
      x: WIDTH * 0.5,
      y: HEIGHT * 0.5,
      width: WIDTH,
      height: HEIGHT,
      anchorX: 0.5,
      anchorY: 0.5,
      zIndex: -300,
      fill: { color: palette.darkNavy, alpha: 1 },
    },
  });

  runtime.reconciler.setObject({
    id: 'battle-ui-horizon',
    kind: 'ellipseGraphic',
    props: {
      x: WIDTH * 0.5,
      y: HEIGHT * 0.52,
      radiusX: WIDTH * 0.39,
      radiusY: HEIGHT * 0.14,
      zIndex: -250,
      fill: { color: palette.darkSlate, alpha: 0.4 },
    },
  });

  for (const node of createNodeLayout()) {
    const phase = node.index * 0.65 + (node.isFront ? 0.3 : 0);
    const bob = Math.sin(elapsed * (node.isFront ? 1.8 : 1.2) + phase) * (node.isFront ? 6.5 : 4);
    const pulse = 1 + Math.sin(elapsed * 2.1 + phase) * 0.035;
    const y = node.y + bob;

    const glowRadius = (node.isFront ? 84 : 62) * pulse;
    const plateRadius = (node.isFront ? 60 : 44) * pulse;
    const innerRadius = (node.isFront ? 45 : 33) * pulse;
    const iconScale = (node.isFront ? 1.38 : 0.95) * pulse;

    const baseZ = node.isFront ? 140 : 70;

    runtime.reconciler.setObject({
      id: `${node.id}-glow`,
      kind: 'circleGraphic',
      props: {
        x: node.x,
        y,
        radius: glowRadius,
        zIndex: baseZ + 10,
        fill: {
          color: node.isFront ? palette.cyan : palette.blue,
          alpha: (node.isFront ? 0.28 : 0.2) + Math.sin(elapsed * 2.2 + phase) * 0.05,
        },
      },
    });

    runtime.reconciler.setObject({
      id: `${node.id}-plate`,
      kind: 'circleGraphic',
      props: {
        x: node.x,
        y,
        radius: plateRadius,
        zIndex: baseZ + 20,
        fill: {
          color: node.isFront ? palette.whiteBlue : palette.paleBlue,
          alpha: node.isFront ? 0.92 : 0.7,
        },
      },
    });

    runtime.reconciler.setObject({
      id: `${node.id}-inner`,
      kind: 'circleGraphic',
      props: {
        x: node.x,
        y,
        radius: innerRadius,
        zIndex: baseZ + 30,
        fill: { color: palette.darkerNavy, alpha: node.isFront ? 0.95 : 0.9 },
      },
    });

    runtime.reconciler.setObject({
      id: `${node.id}-icon`,
      kind: 'sprite',
      props: {
        texture: HEPTAGON_TEXTURE,
        x: node.x,
        y,
        zIndex: baseZ + 40,
        anchorX: 0.5,
        anchorY: 0.5,
        scaleX: iconScale,
        scaleY: iconScale,
        alpha: node.isFront ? 1 : 0.82,
        tint: node.isFront ? palette.yellow : palette.grayBlue,
        rotation: elapsed * 0.12 + phase * 0.1,
      },
    });
  }

  const commands = runtime.reconciler.reconcile();
  runtime.processor.processCommands(commands);
}

function createNodeLayout(): DepthNodeLayout[] {
  const xStart = WIDTH * 0.26;
  const xGap = WIDTH * 0.16;
  const layout: DepthNodeLayout[] = [];

  for (let column = 0; column < NODE_COLUMNS; column++) {
    layout.push({
      id: `back-${column}`,
      x: xStart + xGap * column,
      y: HEIGHT * 0.34,
      isFront: false,
      index: column,
    });
  }

  for (let column = 0; column < NODE_COLUMNS; column++) {
    layout.push({
      id: `front-${column}`,
      x: xStart + xGap * column,
      y: HEIGHT * 0.57,
      isFront: true,
      index: column,
    });
  }

  return layout;
}

function resolveBattlePalette(): BattlePalette {
  return {
    darkNavy: resolveColorVar('--dark-navy'),
    darkSlate: resolveColorVar('--dark-slate'),
    cyan: resolveColorVar('--cyan'),
    blue: resolveColorVar('--blue'),
    whiteBlue: resolveColorVar('--white-blue'),
    paleBlue: resolveColorVar('--pale-blue'),
    darkerNavy: resolveColorVar('--darker-navy'),
    yellow: resolveColorVar('--yellow'),
    grayBlue: resolveColorVar('--gray-blue'),
  };
}

function resolveColorVar(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return cssColorToNumber(raw);
}

function cssColorToNumber(value: string): number {
  const color = value.trim();
  if (!color) return 0;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (!rgbMatch) return 0;
  const [r, g, b] = rgbMatch[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()) || 0);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
