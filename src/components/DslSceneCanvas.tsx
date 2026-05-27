import { useEffect, useRef } from 'react';
import { Application, Container } from 'pixi.js';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';
import { PixiRenderer } from '../rendering/pixiRenderer';
import { OPAQUE_PREVIEW_BACKGROUND } from '../rendering/renderingColors';
import type { CanvasRenderDocument } from '../dsl/types';

type DslSceneCanvasProps = {
  frame: CanvasRenderDocument | null;
  width?: number;
  height?: number;
  transparent?: boolean;
  onRenderError?: (message: string) => void;
};

export function DslSceneCanvas({
  frame,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  transparent = false,
  onRenderError,
}: DslSceneCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const frameRef = useRef<CanvasRenderDocument | null>(null);
  const onRenderErrorRef = useRef(onRenderError);

  useEffect(() => {
    frameRef.current = frame;
    onRenderErrorRef.current = onRenderError;
  }, [frame, onRenderError]);

  const reportRenderError = (error: unknown) => {
    onRenderErrorRef.current?.(error instanceof Error ? error.message : 'DSL 图像渲染失败');
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    const app = new Application();

    void app
      .init({
        width,
        height,
        antialias: true,
        backgroundAlpha: transparent ? 0 : 1,
        backgroundColor: OPAQUE_PREVIEW_BACKGROUND,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }

        const layer = new Container();
        app.stage.addChild(layer);
        const renderer = new PixiRenderer(layer);
        rendererRef.current = renderer;
        appRef.current = app;
        host.appendChild(app.canvas);
        if (frameRef.current) {
          void renderer.render(frameRef.current, 0).catch(reportRenderError);
        }
      })
      .catch((error: unknown) => {
        onRenderErrorRef.current?.(error instanceof Error ? error.message : 'Pixi 初始化失败');
      });

    return () => {
      disposed = true;
      appRef.current?.destroy(true);
      host.replaceChildren();
      appRef.current = null;
      rendererRef.current = null;
    };
  }, [height, transparent, width]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !frame) {
      return;
    }

    void renderer.render(frame, 0).catch(reportRenderError);
  }, [frame]);

  return <div className="pixi-host" ref={hostRef} />;
}
