import { useEffect, useRef, useCallback } from 'react';
import { Application } from 'pixi.js';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getBallsAtFrame } from '../simulation';
import { PixiCommandProcessor } from '../pixiJSRenderer/PixiCommandProcessor';
import { PixiFrameReconciler } from '../pixiJSRenderer/PixiFrameReconciler';
import { PixiCanvas } from '../pixiJSRenderer/PixiCanvas';
import type { PixiReadonlyFrameStateMap } from '../pixiJSRenderer/types';

type PixiBounceCanvasProps = {
  seed: string;
  running: boolean;
  onFrame?: (frameIndex: number, state: PixiReadonlyFrameStateMap) => void;
};

export function PixiBounceCanvas({ seed, running, onFrame }: PixiBounceCanvasProps) {
  const processorRef = useRef<PixiCommandProcessor | null>(null);
  const reconcilerRef = useRef<PixiFrameReconciler | null>(null);
  const frameRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  const drawFrame = useCallback((currentSeed: string, frame: number) => {
    const processor = processorRef.current;
    const reconciler = reconcilerRef.current;
    if (!processor || !reconciler) {
      return;
    }

    // 1. 构建下一帧状态
    reconciler.beginFrame();
    const balls = getBallsAtFrame(currentSeed, frame);
    
    for (const ball of balls) {
      const ballId = `ball-${ball.id}`;
      
      reconciler.setObject({
        id: ballId,
        kind: 'circleGraphic',
        props: {
          x: ball.x,
          y: ball.y,
          radius: ball.radius,
          fill: { color: ball.color, alpha: 0.92 },
          stroke: { width: 3, color: '#ffffff', alpha: 0.2 },
        },
      });
    }

    // 2. 差异对比并获取命令
    const commands = reconciler.reconcile();

    // 3. 执行命令
    processor.processCommands(commands);

    // 4. 回传状态给父组件（用于录制）
    if (onFrame) {
      onFrame(frame, reconciler.getCurrentFrameState());
    }
  }, [onFrame]);

  const handleInit = useCallback((app: Application) => {
    processorRef.current = new PixiCommandProcessor(app);
    reconcilerRef.current = new PixiFrameReconciler();
    
    // 初始帧
    drawFrame(seed, frameRef.current);
  }, [seed, drawFrame]);

  const handleDestroy = useCallback(() => {
    processorRef.current?.destroy();
    processorRef.current = null;
    reconcilerRef.current = null;
  }, []);

  useEffect(() => {
    frameRef.current = 0;
    drawFrame(seed, 0);
  }, [seed, drawFrame]);

  useEffect(() => {
    const tick = () => {
      if (running) {
        frameRef.current += 1;
        drawFrame(seed, frameRef.current);
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, seed, drawFrame]);

  return (
    <PixiCanvas
      width={DEFAULT_WIDTH}
      height={DEFAULT_HEIGHT}
      background="#020817"
      onInit={handleInit}
      onDestroy={handleDestroy}
      className="pixi-host"
    />
  );
}
