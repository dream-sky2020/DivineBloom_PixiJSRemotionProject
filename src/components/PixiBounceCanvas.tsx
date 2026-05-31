import { useEffect, useRef, useCallback, useState } from 'react';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';
import { PixiCommandProcessor } from '../pixiJSRenderer/PixiCommandProcessor';
import { PixiFrameReconciler } from '../pixiJSRenderer/PixiFrameReconciler';
import type { PixiReadonlyFrameStateMap } from '../pixiJSRenderer/types';
import { PhysicsSystem } from '../physics2D/PhysicsSystem';
import type { PhysicsObjectDetailedState } from '../physics2D/PhysicsSystem';
import { PixiPhysicsCanvas } from './PixiPhysicsCanvas';
import type { PixiPhysicsRuntime } from './PixiPhysicsCanvas';

export type PixiBattleRenderMode = 'physics' | 'battle';

export type PixiBattleLayerConfig = {
  texture: string;
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
  anchorX: number;
  anchorY: number;
  visible: boolean;
};

export type PixiBattleCameraConfig = {
  x: number;
  y: number;
  z: number;
  focus: number;
};

export type PixiBattleSceneConfig = {
  camera: PixiBattleCameraConfig;
  background: PixiBattleLayerConfig;
  floor: PixiBattleLayerConfig;
  ceiling: PixiBattleLayerConfig;
  character: PixiBattleLayerConfig;
};

type AssetDefaultConfig = {
  defaultScale?: number;
  defaultAnchorX?: number;
  defaultAnchorY?: number;
};

type AssetManifestEntry = {
  url: string;
  defaultScale?: number;
  defaultAnchorX?: number;
  defaultAnchorY?: number;
};

type PixiBounceCanvasProps = {
  seed: string;
  running: boolean;
  resetKey?: number;
  showDebugOverlay?: boolean;
  onFrame?: (frameIndex: number, state: PixiReadonlyFrameStateMap) => void;
  renderMode?: PixiBattleRenderMode;
  battleScene?: PixiBattleSceneConfig;
};

export function PixiBounceCanvas({
  seed,
  running,
  resetKey,
  showDebugOverlay = false,
  onFrame,
  renderMode = 'physics',
  battleScene,
}: PixiBounceCanvasProps) {
  const processorRef = useRef<PixiCommandProcessor | null>(null);
  const reconcilerRef = useRef<PixiFrameReconciler | null>(null);
  const physicsRef = useRef<PhysicsSystem | null>(null);
  const frameRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const [isRuntimeReady, setIsRuntimeReady] = useState(false);
  const assetDefaultsRef = useRef<Map<string, AssetDefaultConfig>>(new Map());

  const setupScene = useCallback(() => {
    if (!physicsRef.current) return;
    
    const physics = physicsRef.current;
    // 清空当前世界中的所有物体
    physics.destroy();
    const newPhysics = physics;

    // 创建边界 (静态矩形)
    const thickness = 100;
    const wallOptions = { restitution: 1.0, friction: 0.0 };
    // 上
    newPhysics.createRectangle('wall-top', DEFAULT_WIDTH / 2, -thickness / 2, DEFAULT_WIDTH, thickness, true, wallOptions);
    // 下
    newPhysics.createRectangle('wall-bottom', DEFAULT_WIDTH / 2, DEFAULT_HEIGHT + thickness / 2, DEFAULT_WIDTH, thickness, true, wallOptions);
    // 左
    newPhysics.createRectangle('wall-left', -thickness / 2, DEFAULT_HEIGHT / 2, thickness, DEFAULT_HEIGHT, true, wallOptions);
    // 右
    newPhysics.createRectangle('wall-right', DEFAULT_WIDTH + thickness / 2, DEFAULT_HEIGHT / 2, thickness, DEFAULT_HEIGHT, true, wallOptions);

    // 根据 seed 创建一些随机物体
    const colors = ['#7ee7d9', '#ffce73', '#7fa7ff', '#ff7aa9', '#b08cff', '#8cff9f'];
    
    // 简单的伪随机
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) seedNum += seed.charCodeAt(i);
    const random = () => {
      seedNum = (seedNum * 9301 + 49297) % 233280;
      return seedNum / 233280;
    };

    for (let i = 0; i < 15; i++) {
      const x = 100 + random() * (DEFAULT_WIDTH - 200);
      const y = 100 + random() * (DEFAULT_HEIGHT - 200);
      const color = colors[i % colors.length];
      const type = i % 4;
      
      const options = { 
        color, 
        restitution: 1.0, // 无损反弹
        friction: 0.0     // 无摩擦
      };

      let body;
      if (type === 0) {
        body = newPhysics.createCircle(`obj-${i}`, x, y, 20 + random() * 20, false, options);
      } else if (type === 1) {
        body = newPhysics.createRectangle(`obj-${i}`, x, y, 40 + random() * 40, 40 + random() * 40, false, options);
      } else if (type === 2) {
        // 三角形
        const size = 30 + random() * 30;
        body = newPhysics.createTriangle(`obj-${i}`, x, y, 
          { x: 0, y: -size }, 
          { x: -size, y: size }, 
          { x: size, y: size }, 
          false, options);
      } else {
        // 五边形
        const size = 30 + random() * 30;
        const points = [];
        for (let j = 0; j < 5; j++) {
          const angle = (j / 5) * Math.PI * 2;
          points.push({ x: Math.cos(angle) * size, y: Math.sin(angle) * size });
        }
        body = newPhysics.createPolygon(`obj-${i}`, x, y, points, false, options);
      }

      // 给一个初始随机速度 (力)
      if (body) {
        const velX = (random() - 0.5) * 500;
        const velY = (random() - 0.5) * 500;
        newPhysics.setLinearVelocity(`obj-${i}`, velX, velY);
      }
    }
  }, [seed]);

  const runningRef = useRef(running);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const showDebugOverlayRef = useRef(showDebugOverlay);
  useEffect(() => {
    showDebugOverlayRef.current = showDebugOverlay;
  }, [showDebugOverlay]);

  useEffect(() => {
    let cancelled = false;
    const loadAssetDefaults = async () => {
      try {
        const response = await fetch('/asset_manifest.json');
        if (!response.ok) {
          return;
        }
        const manifest = (await response.json()) as AssetManifestEntry[];
        if (cancelled) {
          return;
        }
        const byUrl = new Map<string, AssetDefaultConfig>();
        for (const entry of manifest) {
          byUrl.set(entry.url, {
            defaultScale: entry.defaultScale,
            defaultAnchorX: entry.defaultAnchorX,
            defaultAnchorY: entry.defaultAnchorY,
          });
        }
        assetDefaultsRef.current = byUrl;
      } catch {
        // 忽略清单加载失败，保持回退行为。
      }
    };

    void loadAssetDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderModeRef = useRef<PixiBattleRenderMode>(renderMode);
  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);

  const battleSceneRef = useRef<PixiBattleSceneConfig | undefined>(battleScene);
  useEffect(() => {
    battleSceneRef.current = battleScene;
  }, [battleScene]);

  const appendDebugOverlayObjects = useCallback((reconciler: PixiFrameReconciler, detail: PhysicsObjectDetailedState) => {
    const points = detail.worldPoints;
    if (!points || points.length < 2 || detail.id.startsWith('wall-')) {
      return;
    }

    reconciler.setObject({
      id: `debug-outline-${detail.id}`,
      kind: 'polygonGraphic',
      props: {
        points,
        stroke: { width: 1.5, alpha: 0.9 },
        fill: { alpha: 0.04 },
      },
    });

    reconciler.setObject({
      id: `debug-center-${detail.id}`,
      kind: 'circleGraphic',
      props: {
        x: detail.worldCenter.x,
        y: detail.worldCenter.y,
        radius: 2.4,
        fill: { alpha: 0.95 },
      },
    });
  }, []);

  const drawFrame = useCallback((frame: number) => {
    const processor = processorRef.current;
    const reconciler = reconcilerRef.current;
    const physics = physicsRef.current;
    
    if (!processor || !reconciler || !physics) {
      return;
    }

    reconciler.beginFrame();
    if (renderModeRef.current === 'battle') {
      if (battleSceneRef.current) {
        applyBattleSceneObjects(reconciler, battleSceneRef.current, assetDefaultsRef.current);
      }
    } else {
      // 1. 物理步进
      if (runningRef.current) {
        // 使用 4 个子步 (substeps) 来极大提高碰撞精度，防止穿模
        physics.step(4);
      }

      // 2. 构建下一帧状态
      const states = physics.getAllStates();

      for (const state of states) {
        if (state.id.startsWith('wall-')) continue; // 不渲染墙壁

        let kind: any = 'circleGraphic';
        const props: any = {
          x: state.x,
          y: state.y,
          rotation: state.rotation,
          fill: { color: state.color || '#ffffff', alpha: 0.92 },
          stroke: { width: 2, color: '#ffffff', alpha: 0.3 },
        };

        if (state.type === 'circle') {
          kind = 'circleGraphic';
          props.radius = state.radius;
        } else if (state.type === 'rectangle') {
          kind = 'rectangleGraphic';
          props.width = state.width;
          props.height = state.height;
          props.anchorX = 0.5;
          props.anchorY = 0.5;
        } else if (state.type === 'triangle' || state.type === 'polygon') {
          kind = 'polygonGraphic';
          props.points = state.points;
        }

        reconciler.setObject({
          id: state.id,
          kind,
          props,
        });
      }

      if (showDebugOverlayRef.current) {
        const detailedStates = physics.getAllDetailedStates({ circleSegments: 40 });
        for (const detailedState of detailedStates) {
          appendDebugOverlayObjects(reconciler, detailedState);
        }
      }
    }

    // 3. 差异对比并获取命令
    const commands = reconciler.reconcile();

    // 4. 执行命令
    processor.processCommands(commands);

    // 5. 回传状态给父组件（用于录制）
    if (onFrameRef.current && runningRef.current) {
      onFrameRef.current(frame, reconciler.getCurrentFrameState());
    }
  }, [appendDebugOverlayObjects]);

  const handleRuntimeReady = useCallback((runtime: PixiPhysicsRuntime) => {
    processorRef.current = runtime.processor;
    reconcilerRef.current = runtime.reconciler;
    physicsRef.current = runtime.physics;
    frameRef.current = 0;
    setIsRuntimeReady(true);
    if (renderModeRef.current === 'physics') {
      setupScene();
    }
    drawFrame(0);
  }, [setupScene, drawFrame]);

  const handleRuntimeDestroy = useCallback(() => {
    processorRef.current = null;
    reconcilerRef.current = null;
    physicsRef.current = null;
    setIsRuntimeReady(false);
  }, []);

  useEffect(() => {
    if (isRuntimeReady && physicsRef.current && renderMode === 'physics') {
      frameRef.current = 0;
      setupScene();
      drawFrame(0);
    }
  }, [seed, isRuntimeReady, setupScene, drawFrame, resetKey, renderMode]);

  useEffect(() => {
    if (isRuntimeReady) {
      frameRef.current = 0;
      drawFrame(0);
    }
  }, [isRuntimeReady, drawFrame, battleScene, renderMode]);

  useEffect(() => {
    const tick = () => {
      if (isRuntimeReady) {
        if (running) {
          frameRef.current += 1;
        }
        drawFrame(frameRef.current);
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, isRuntimeReady, drawFrame]);

  return (
    <PixiPhysicsCanvas
      width={DEFAULT_WIDTH}
      height={DEFAULT_HEIGHT}
      background="#020817"
      gravity={{ x: 0, y: 0 }}
      onReady={handleRuntimeReady}
      onDestroy={handleRuntimeDestroy}
      className="pixi-host"
    />
  );
}

function applyBattleSceneObjects(
  reconciler: PixiFrameReconciler,
  scene: PixiBattleSceneConfig,
  assetDefaultsByUrl: Map<string, AssetDefaultConfig>,
) {
  reconciler.setObject({
    id: 'battle-camera',
    kind: 'camera',
    props: {
      x: scene.camera.x,
      y: scene.camera.y,
      z: scene.camera.z,
      focus: scene.camera.focus,
    },
  });

  applyBattleLayer(reconciler, 'battle-background', scene.background, -100, assetDefaultsByUrl);
  applyBattleLayer(reconciler, 'battle-floor', scene.floor, -50, assetDefaultsByUrl);
  applyBattleLayer(reconciler, 'battle-ceiling', scene.ceiling, 50, assetDefaultsByUrl);
  applyBattleLayer(reconciler, 'battle-character', scene.character, 200, assetDefaultsByUrl);
}

function applyBattleLayer(
  reconciler: PixiFrameReconciler,
  id: string,
  layer: PixiBattleLayerConfig,
  fallbackZIndex: number,
  assetDefaultsByUrl: Map<string, AssetDefaultConfig>,
) {
  const mergedLayer = applyAssetDefaults(layer, assetDefaultsByUrl);
  const texture = layer.texture
    ? { kind: 'image' as const, image: layer.texture }
    : undefined;

  reconciler.setObject({
    id,
    kind: 'sprite',
    props: {
      texture,
      x: mergedLayer.x,
      y: mergedLayer.y,
      z: mergedLayer.z,
      zIndex: fallbackZIndex,
      scaleX: mergedLayer.scaleX,
      scaleY: mergedLayer.scaleY,
      rotation: mergedLayer.rotation,
      rotationX: mergedLayer.rotationX,
      rotationY: mergedLayer.rotationY,
      anchorX: mergedLayer.anchorX,
      anchorY: mergedLayer.anchorY,
      visible: mergedLayer.visible,
    },
  });
}

function applyAssetDefaults(
  layer: PixiBattleLayerConfig,
  assetDefaultsByUrl: Map<string, AssetDefaultConfig>,
): PixiBattleLayerConfig {
  const defaults = assetDefaultsByUrl.get(layer.texture);
  if (!defaults) {
    return layer;
  }

  const next = { ...layer };
  if (defaults.defaultScale !== undefined && layer.scaleX === 1 && layer.scaleY === 1) {
    next.scaleX = defaults.defaultScale;
    next.scaleY = defaults.defaultScale;
  }
  if (defaults.defaultAnchorX !== undefined && layer.anchorX === 0.5) {
    next.anchorX = defaults.defaultAnchorX;
  }
  if (defaults.defaultAnchorY !== undefined && layer.anchorY === 0.5) {
    next.anchorY = defaults.defaultAnchorY;
  }
  return next;
}
