import { useEffect, useRef, useState } from 'react';
import { useCurrentFrame, useVideoConfig, continueRender, delayRender } from 'remotion';
import { Application, Assets, Sprite } from 'pixi.js';

export const PixiComposition = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const bunnyRef = useRef<Sprite | null>(null);
  
  // 修复 1：使用 useState 初始化 handle，避免在渲染期间访问 ref.current
  // 同时也修复了错误的解构语法（delayRender 返回的是单个 handle 而不是数组）
  const [handle] = useState(() => delayRender('Loading PixiJS Assets'));

  useEffect(() => {
    const initPixi = async () => {
      if (!canvasRef.current) return;

      const app = new Application();
      await app.init({
        width,
        height,
        background: '#1099bb',
        antialias: true,
        resolution: 1,
      });

      appRef.current = app;
      canvasRef.current.appendChild(app.canvas);

      const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
      const bunny = new Sprite(texture);
      bunny.anchor.set(0.5);
      bunny.x = width / 2;
      bunny.y = height / 2;
      app.stage.addChild(bunny);
      bunnyRef.current = bunny;

      // 资源加载完成后继续渲染
      continueRender(handle);
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
      }
    };
  }, [width, height, handle]); // 现在 handle 是 state，可以安全地放入依赖数组

  // 关键：使用 Remotion 的帧率来驱动 Pixi 动画，而不是使用 Pixi 的 Ticker
  useEffect(() => {
    if (bunnyRef.current) {
      // 每一帧根据 frame 计算旋转角度，确保录制结果是确定性的
      bunnyRef.current.rotation = (frame / fps) * 2 * Math.PI * 0.5; // 每 2 秒转一圈
      
      // 手动渲染当前帧
      if (appRef.current) {
        appRef.current.renderer.render(appRef.current.stage);
      }
    }
  }, [frame, fps]);

  return <div ref={canvasRef} />;
};
