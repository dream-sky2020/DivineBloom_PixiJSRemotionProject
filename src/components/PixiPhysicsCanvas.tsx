import { useCallback, useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { ApplicationOptions } from 'pixi.js';
import { PixiCanvas } from '../pixiJSRenderer/PixiCanvas';
import { PixiCommandProcessor } from '../pixiJSRenderer/PixiCommandProcessor';
import { PixiFrameReconciler } from '../pixiJSRenderer/PixiFrameReconciler';
import { PhysicsSystem } from '../physics2D/PhysicsSystem';

export type PixiPhysicsRuntime = {
  app: Application;
  processor: PixiCommandProcessor;
  reconciler: PixiFrameReconciler;
  physics: PhysicsSystem;
};

export interface PixiPhysicsCanvasProps extends Partial<ApplicationOptions> {
  /** 物理世界重力，默认无重力 */
  gravity?: { x: number; y: number };
  /** Pixi + Physics 全部初始化完成后的回调 */
  onReady?: (runtime: PixiPhysicsRuntime) => void;
  /** 销毁前的回调 */
  onDestroy?: (runtime: PixiPhysicsRuntime) => void;
  /** 容器类名 */
  className?: string;
}

export function PixiPhysicsCanvas({
  gravity = { x: 0, y: 0 },
  onReady,
  onDestroy,
  className,
  ...options
}: PixiPhysicsCanvasProps) {
  const appRef = useRef<Application | null>(null);
  const processorRef = useRef<PixiCommandProcessor | null>(null);
  const reconcilerRef = useRef<PixiFrameReconciler | null>(null);
  const physicsRef = useRef<PhysicsSystem | null>(null);
  const onReadyRef = useRef(onReady);
  const onDestroyRef = useRef(onDestroy);
  const [isPixiReady, setIsPixiReady] = useState(false);
  const [isPhysicsReady, setIsPhysicsReady] = useState(false);
  const readyNotifiedRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onDestroyRef.current = onDestroy;
  }, [onDestroy]);

  useEffect(() => {
    let cancelled = false;
    PhysicsSystem.init()
      .then(() => {
        if (!cancelled) {
          setIsPhysicsReady(true);
        }
      })
      .catch((error) => {
        console.error('PhysicsSystem initialization failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPixiReady || !isPhysicsReady) {
      return;
    }
    if (
      readyNotifiedRef.current ||
      !appRef.current ||
      !processorRef.current ||
      !reconcilerRef.current ||
      !physicsRef.current
    ) {
      return;
    }

    readyNotifiedRef.current = true;
    onReadyRef.current?.({
      app: appRef.current,
      processor: processorRef.current,
      reconciler: reconcilerRef.current,
      physics: physicsRef.current,
    });
  }, [isPixiReady, isPhysicsReady]);

  const handleInit = useCallback(
    (app: Application) => {
      appRef.current = app;
      processorRef.current = new PixiCommandProcessor(app);
      reconcilerRef.current = new PixiFrameReconciler();
      physicsRef.current = new PhysicsSystem(gravity);
      readyNotifiedRef.current = false;
      setIsPixiReady(true);
    },
    [gravity],
  );

  const handleDestroy = useCallback(() => {
    const runtime =
      appRef.current &&
      processorRef.current &&
      reconcilerRef.current &&
      physicsRef.current
        ? {
            app: appRef.current,
            processor: processorRef.current,
            reconciler: reconcilerRef.current,
            physics: physicsRef.current,
          }
        : null;

    if (runtime) {
      onDestroyRef.current?.(runtime);
    }

    processorRef.current?.destroy();
    processorRef.current = null;
    reconcilerRef.current = null;
    physicsRef.current?.destroy();
    physicsRef.current = null;
    appRef.current = null;
    readyNotifiedRef.current = false;
    setIsPixiReady(false);
  }, []);

  return <PixiCanvas onInit={handleInit} onDestroy={handleDestroy} className={className} {...options} />;
}
