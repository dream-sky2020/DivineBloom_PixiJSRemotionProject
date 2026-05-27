import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import type { ApplicationOptions } from 'pixi.js';

export interface PixiCanvasProps extends Partial<ApplicationOptions> {
  /** 初始化完成后的回调 */
  onInit?: (app: Application) => void;
  /** 销毁前的回调 */
  onDestroy?: (app: Application) => void;
  /** 容器的 CSS 类名 */
  className?: string;
}

/**
 * 通用的 PixiJS Canvas 宿主组件
 * 处理了 PixiJS v8 的异步初始化、安全销毁以及显存释放
 */
export function PixiCanvas({ 
  onInit, 
  onDestroy, 
  className, 
  ...options 
}: PixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const app = new Application();
    appRef.current = app;

    const init = async () => {
      try {
        await app.init({
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          ...options,
        });

        if (disposed) {
          app.destroy(true, { children: true, texture: true });
          return;
        }

        host.appendChild(app.canvas);
        onInit?.(app);
      } catch (error) {
        console.error('Failed to initialize PixiJS Application:', error);
      }
    };

    init();

    return () => {
      disposed = true;
      if (app.renderer) {
        onDestroy?.(app);
        app.destroy(true, { children: true, texture: true });
      }
      appRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className={className} />;
}
