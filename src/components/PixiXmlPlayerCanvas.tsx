import { useEffect, useRef, useCallback } from 'react';
import { Application } from 'pixi.js';
import { PixiCommandProcessor } from '../pixiJSRenderer/PixiCommandProcessor';
import { PixiFrameReconciler } from '../pixiJSRenderer/PixiFrameReconciler';
import { PixiCanvas } from '../pixiJSRenderer/PixiCanvas';
import type { LoadedCanvas } from '../pixiJSRenderer/PixiXmlLoader';

type PixiXmlPlayerCanvasProps = {
  loadedCanvas: LoadedCanvas;
  currentFrame: number;
  className?: string;
};

export function PixiXmlPlayerCanvas({ loadedCanvas, currentFrame, className }: PixiXmlPlayerCanvasProps) {
  const processorRef = useRef<PixiCommandProcessor | null>(null);
  const reconcilerRef = useRef<PixiFrameReconciler | null>(null);

  const drawFrame = useCallback((frameIndex: number) => {
    const processor = processorRef.current;
    const reconciler = reconcilerRef.current;
    if (!processor || !reconciler || !loadedCanvas) {
      return;
    }

    const frameState = loadedCanvas.frames[frameIndex];
    if (!frameState) return;

    // 1. 构建下一帧状态
    reconciler.beginFrame();
    
    frameState.forEach((objState) => {
      reconciler.setObject(objState);
    });

    // 2. 差异对比并获取命令
    const commands = reconciler.reconcile();

    // 3. 执行命令
    processor.processCommands(commands);
  }, [loadedCanvas]);

  const handleInit = useCallback((app: Application) => {
    processorRef.current = new PixiCommandProcessor(app);
    reconcilerRef.current = new PixiFrameReconciler();
    
    // 初始帧
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  const handleDestroy = useCallback(() => {
    processorRef.current?.destroy();
    processorRef.current = null;
    reconcilerRef.current = null;
  }, []);

  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  return (
    <PixiCanvas
      width={loadedCanvas.width}
      height={loadedCanvas.height}
      background="#020817"
      onInit={handleInit}
      onDestroy={handleDestroy}
      className={className}
    />
  );
}
