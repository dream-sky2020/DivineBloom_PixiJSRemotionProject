import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getBallsAtFrame } from '../simulation';

type PixiBounceCanvasProps = {
  seed: string;
  running: boolean;
};

export function PixiBounceCanvas({ seed, running }: PixiBounceCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const layerRef = useRef<Container | null>(null);
  const frameRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    const app = new Application();

    void app
      .init({
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        antialias: true,
        background: '#020817',
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
        host.appendChild(app.canvas);
        appRef.current = app;
        layerRef.current = layer;
        drawFrame(seed, frameRef.current);
      });

    return () => {
      disposed = true;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      appRef.current?.destroy(true);
      appRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    frameRef.current = 0;
    drawFrame(seed, 0);
  }, [seed]);

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
  }, [running, seed]);

  const drawFrame = (currentSeed: string, frame: number) => {
    const layer = layerRef.current;
    if (!layer) {
      return;
    }

    layer.removeChildren();
    for (const ball of getBallsAtFrame(currentSeed, frame)) {
      const graphics = new Graphics();
      graphics.circle(ball.x, ball.y, ball.radius);
      graphics.fill({ color: ball.color, alpha: 0.92 });
      graphics.stroke({ width: 3, color: '#ffffff', alpha: 0.2 });
      layer.addChild(graphics);
    }
  };

  return <div className="pixi-host" ref={hostRef} />;
}
