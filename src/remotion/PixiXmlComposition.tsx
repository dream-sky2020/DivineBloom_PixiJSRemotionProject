import { AbsoluteFill, useCurrentFrame, staticFile, delayRender, continueRender } from 'remotion';
import { useState, useEffect } from 'react';
import { PixiXmlLoader } from '../pixiJSRenderer/PixiXmlLoader';
import type { LoadedCanvas } from '../pixiJSRenderer/PixiXmlLoader';
import { z } from 'zod';

export const pixiXmlSchema = z.object({
  xmlPath: z.string(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  durationInFrames: z.number(),
});

export function PixiXmlComposition({ xmlPath, width, height }: z.infer<typeof pixiXmlSchema>) {
  const frame = useCurrentFrame();
  const [loadedCanvas, setLoadedCanvas] = useState<LoadedCanvas | null>(null);
  const [handle] = useState(() => delayRender('Loading XML'));

  useEffect(() => {
    fetch(staticFile(xmlPath))
      .then((res) => res.text())
      .then((xml) => {
        const result = PixiXmlLoader.load(xml);
        setLoadedCanvas(result);
        continueRender(handle);
      })
      .catch((err) => {
        console.error('Failed to load XML in Remotion:', err);
        continueRender(handle);
      });
  }, [xmlPath, handle]);

  if (!loadedCanvas) return null;

  const frameState = loadedCanvas.frames[frame];
  if (!frameState) return null;

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 18% 18%, rgba(47, 127, 255, 0.28), transparent 38%), #020817',
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect width={width} height={height} fill="#020817" fillOpacity={0.4} />
        
        {Array.from(frameState.values()).map((obj) => {
          const p = obj.props as any;
          
          // 基础属性
          const x = p.x ?? 0;
          const y = p.y ?? 0;
          const rotation = (p.rotation ?? 0) * (180 / Math.PI); // 转换为角度
          const alpha = p.alpha ?? 1;
          
          const transform = `translate(${x}, ${y}) rotate(${rotation})`;

          if (obj.kind === 'circleGraphic' || obj.kind === 'sprite' || obj.kind === 'particle') {
            const radius = p.radius ?? 20;
            const color = p.color || (p.fill ? p.fill.color : '#ffffff');
            
            return (
              <circle
                key={obj.id}
                cx={0}
                cy={0}
                r={radius}
                fill={color}
                fillOpacity={alpha * (p.fill?.alpha ?? 0.92)}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={3}
                transform={transform}
              />
            );
          }
          
          if (obj.kind === 'rectangleGraphic') {
            const w = p.width ?? 100;
            const h = p.height ?? 100;
            const color = p.fill?.color ?? '#ffffff';
            
            return (
              <rect
                key={obj.id}
                x={-(p.anchorX ?? 0) * w}
                y={-(p.anchorY ?? 0) * h}
                width={w}
                height={h}
                fill={color}
                fillOpacity={alpha * (p.fill?.alpha ?? 1)}
                stroke={p.stroke?.color}
                strokeWidth={p.stroke?.width}
                transform={transform}
              />
            );
          }

          if (obj.kind === 'polygonGraphic') {
            const points = p.points as { x: number, y: number }[];
            if (!points) return null;
            const color = p.fill?.color ?? '#ffffff';
            const pointsStr = points.map(pt => `${pt.x},${pt.y}`).join(' ');

            return (
              <polygon
                key={obj.id}
                points={pointsStr}
                fill={color}
                fillOpacity={alpha * (p.fill?.alpha ?? 1)}
                stroke={p.stroke?.color}
                strokeWidth={p.stroke?.width}
                transform={transform}
              />
            );
          }

          return null;
        })}

        <text
          x={32}
          y={54}
          fill="rgba(238, 244, 255, 0.7)"
          fontFamily="Inter, Arial, sans-serif"
          fontSize={28}
          fontWeight={700}
        >
          XML: {loadedCanvas.name} / frame: {frame}
        </text>
      </svg>
    </AbsoluteFill>
  );
}
