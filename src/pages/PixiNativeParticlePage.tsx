import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Sprite, Texture } from 'pixi.js';

const WIDTH = 1280;
const HEIGHT = 720;
const NODE_TEXTURE_PATH = '/heptagon_45.svg';
const CIRCLE_TEXTURE_PATH = '/particle_white.svg';
const NODE_COLUMNS = 4;

type DepthNodeVisual = {
  root: Container;
  glow: Sprite;
  plate: Sprite;
  inner: Sprite;
  icon: Sprite;
  baseX: number;
  baseY: number;
  baseScale: number;
  bobAmplitude: number;
  bobSpeed: number;
  phase: number;
  glowAlphaBase: number;
};

type BattlePalette = {
  darkNavy: number;
  darkSlate: number;
  deepBlackBlue: number;
  cyan: number;
  blue: number;
  whiteBlue: number;
  paleBlue: number;
  darkerNavy: number;
  yellow: number;
  grayBlue: number;
};

export function PixiNativeParticlePage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const runningRef = useRef(true);
  const sceneRootRef = useRef<Container | null>(null);
  const nodesRef = useRef<DepthNodeVisual[]>([]);
  const [running, setRunning] = useState(true);

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
      app.stage.sortableChildren = true;

      const [heptagonTexture, circleTexture] = await Promise.all([
        Assets.load<Texture>(NODE_TEXTURE_PATH),
        Assets.load<Texture>(CIRCLE_TEXTURE_PATH),
      ]);

      if (disposed) return;

      const palette = resolveBattlePalette();
      const sceneRoot = new Container();
      sceneRootRef.current = sceneRoot;
      app.stage.addChild(sceneRoot);

      renderBackground(sceneRoot, palette);
      nodesRef.current = createDepthNodes(sceneRoot, heptagonTexture, circleTexture, palette);

      let elapsed = 0;
      app.ticker.add((ticker) => {
        if (!runningRef.current) return;
        const deltaSeconds = Math.min(0.05, Math.max(0.001, ticker.deltaMS / 1000));
        elapsed += deltaSeconds;
        animateDepthNodes(nodesRef.current, elapsed);
      });
    };

    void init().catch((error) => {
      console.error('Pixi native battle core init failed:', error);
    });

    return () => {
      disposed = true;
      nodesRef.current = [];
      sceneRootRef.current = null;
      if (appRef.current?.renderer) {
        appRef.current.destroy(true, { children: true, texture: true });
      }
      appRef.current = null;
    };
  }, []);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Pixi Native</p>
        <h1>核心战斗 UI 外观（伪3D节点）</h1>
        <p className="summary">
          使用 `heptagon_45.svg` 生成两排节点：上排更小更远，下排更大更近，模拟核心战斗区景深。
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
            {running ? '暂停动效' : '继续动效'}
          </button>
        </div>
      </section>

      <p className="status">节点总数: 8（前排 4 / 后排 4）</p>
    </div>
  );
}

function renderBackground(root: Container, palette: BattlePalette) {
  const base = new Sprite(Texture.WHITE);
  base.width = WIDTH;
  base.height = HEIGHT;
  base.tint = palette.darkNavy;
  base.alpha = 1;
  base.zIndex = -300;
  root.addChild(base);

  const horizon = new Sprite(Texture.WHITE);
  horizon.anchor.set(0.5, 0.5);
  horizon.x = WIDTH * 0.5;
  horizon.y = HEIGHT * 0.53;
  horizon.width = WIDTH * 0.84;
  horizon.height = HEIGHT * 0.26;
  horizon.tint = palette.darkSlate;
  horizon.alpha = 0.45;
  horizon.zIndex = -250;
  root.addChild(horizon);

  const floor = new Sprite(Texture.WHITE);
  floor.anchor.set(0.5, 0.5);
  floor.x = WIDTH * 0.5;
  floor.y = HEIGHT * 0.74;
  floor.width = WIDTH * 0.9;
  floor.height = HEIGHT * 0.24;
  floor.tint = palette.deepBlackBlue;
  floor.alpha = 0.68;
  floor.zIndex = -240;
  root.addChild(floor);
}

function createDepthNodes(
  root: Container,
  heptagonTexture: Texture,
  circleTexture: Texture,
  palette: BattlePalette,
): DepthNodeVisual[] {
  const nodes: DepthNodeVisual[] = [];
  const xStart = WIDTH * 0.26;
  const xGap = WIDTH * 0.16;

  for (let column = 0; column < NODE_COLUMNS; column++) {
    nodes.push(
      createNodeVisual({
        root,
        id: `back-${column}`,
        heptagonTexture,
        circleTexture,
        palette,
        x: xStart + xGap * column,
        y: HEIGHT * 0.34,
        isFront: false,
        index: column,
      }),
    );
  }

  for (let column = 0; column < NODE_COLUMNS; column++) {
    nodes.push(
      createNodeVisual({
        root,
        id: `front-${column}`,
        heptagonTexture,
        circleTexture,
        palette,
        x: xStart + xGap * column,
        y: HEIGHT * 0.57,
        isFront: true,
        index: column,
      }),
    );
  }

  return nodes;
}

function createNodeVisual({
  root,
  heptagonTexture,
  circleTexture,
  palette,
  x,
  y,
  isFront,
  index,
}: {
  root: Container;
  id: string;
  heptagonTexture: Texture;
  circleTexture: Texture;
  palette: BattlePalette;
  x: number;
  y: number;
  isFront: boolean;
  index: number;
}): DepthNodeVisual {
  const nodeRoot = new Container();
  nodeRoot.x = x;
  nodeRoot.y = y;
  nodeRoot.zIndex = isFront ? 160 + index : 80 + index;
  nodeRoot.sortableChildren = true;
  root.addChild(nodeRoot);

  const glow = new Sprite(circleTexture);
  glow.anchor.set(0.5, 0.5);
  glow.tint = isFront ? palette.cyan : palette.blue;
  glow.alpha = isFront ? 0.28 : 0.2;
  glow.scale.set(isFront ? 4.4 : 3.3, isFront ? 4.4 : 3.3);
  glow.zIndex = 10;
  nodeRoot.addChild(glow);

  const plate = new Sprite(circleTexture);
  plate.anchor.set(0.5, 0.5);
  plate.tint = isFront ? palette.whiteBlue : palette.paleBlue;
  plate.alpha = isFront ? 0.92 : 0.7;
  plate.scale.set(isFront ? 3.2 : 2.4, isFront ? 3.2 : 2.4);
  plate.zIndex = 20;
  nodeRoot.addChild(plate);

  const inner = new Sprite(circleTexture);
  inner.anchor.set(0.5, 0.5);
  inner.tint = palette.darkerNavy;
  inner.alpha = isFront ? 0.95 : 0.9;
  inner.scale.set(isFront ? 2.45 : 1.8, isFront ? 2.45 : 1.8);
  inner.zIndex = 30;
  nodeRoot.addChild(inner);

  const icon = new Sprite(heptagonTexture);
  icon.anchor.set(0.5, 0.5);
  icon.tint = isFront ? palette.yellow : palette.grayBlue;
  icon.alpha = isFront ? 1 : 0.82;
  icon.scale.set(isFront ? 1.38 : 0.95, isFront ? 1.38 : 0.95);
  icon.zIndex = 40;
  nodeRoot.addChild(icon);

  return {
    root: nodeRoot,
    glow,
    plate,
    inner,
    icon,
    baseX: x,
    baseY: y,
    baseScale: isFront ? 1 : 0.82,
    bobAmplitude: isFront ? 6.5 : 4,
    bobSpeed: isFront ? 1.8 : 1.2,
    phase: index * 0.65 + (isFront ? 0.3 : 0),
    glowAlphaBase: isFront ? 0.28 : 0.2,
  };
}

function animateDepthNodes(nodes: DepthNodeVisual[], elapsed: number) {
  for (const node of nodes) {
    const bob = Math.sin(elapsed * node.bobSpeed + node.phase) * node.bobAmplitude;
    const pulse = 1 + Math.sin(elapsed * 2.1 + node.phase) * 0.035;

    node.root.x = node.baseX;
    node.root.y = node.baseY + bob;
    node.root.scale.set(node.baseScale * pulse, node.baseScale * pulse);
    node.glow.alpha = node.glowAlphaBase + Math.sin(elapsed * 2.2 + node.phase) * 0.05;
    node.icon.rotation += 0.0035;
  }
}

function resolveBattlePalette(): BattlePalette {
  return {
    darkNavy: resolveColorVar('--dark-navy'),
    darkSlate: resolveColorVar('--dark-slate'),
    deepBlackBlue: resolveColorVar('--deep-black-blue'),
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
