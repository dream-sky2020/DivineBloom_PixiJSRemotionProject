import { useEffect, useRef } from 'react';
import { Application, Assets, Sprite } from 'pixi.js';

export const HighPerfCanvas = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    const initPixi = async () => {
      if (!canvasRef.current) return;

      // 1. 初始化 PixiJS Application
      const app = new Application();

      await app.init({
        background: '#1099bb',
        resizeTo: window,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      appRef.current = app;
      canvasRef.current.appendChild(app.canvas);

      // 2. 示例内容
      const texture = await Assets.load('https://pixijs.com/assets/bunny.png');
      const bunny = new Sprite(texture);
      
      bunny.anchor.set(0.5);
      bunny.x = app.screen.width / 2;
      bunny.y = app.screen.height / 2;
      
      app.stage.addChild(bunny);

      app.ticker.add((ticker) => {
        bunny.rotation += 0.1 * ticker.deltaTime;
      });

      // --- 新增：定期保存功能 ---
      const saveInterval = setInterval(async () => {
        if (!appRef.current) return;

        try {
          // 使用 PixiJS v8 的 extract 模块获取当前渲染图
          // 可以提取 stage（整个场景）或特定的容器
          const canvas = await app.renderer.extract.canvas(app.stage);
          const dataUrl = canvas.toDataURL('image/png');
          
          // 创建临时下载链接
          const link = document.createElement('a');
          const timestamp = new Date().getTime();
          link.download = `pixi-capture-${timestamp}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          console.log(`已保存截图: pixi-capture-${timestamp}.png`);
        } catch (error) {
          console.error('保存图片失败:', error);
        }
      }, 10000); // 每 10 秒保存一次

      return () => {
        clearInterval(saveInterval);
      };
    };

    initPixi();

    // 4. 防止内存爆炸的关键：组件卸载时彻底销毁资源
    return () => {
      if (appRef.current) {
        // destroy 参数说明：
        // removeView: 从 DOM 中移除 canvas
        // children: 递归销毁所有子对象
        // texture: 销毁关联的纹理
        appRef.current.destroy(true, {
          children: true,
          texture: true,
        });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={canvasRef} 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0
      }} 
    />
  );
};
