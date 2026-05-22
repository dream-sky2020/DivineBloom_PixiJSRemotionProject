import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { z } from 'zod';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, getBallsAtFrame } from '../simulation';

export const pixiCompositionSchema = z.object({
  seed: z.string(),
  fromFrame: z.number().default(0),
  durationInFrames: z.number().optional(),
  fps: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

type PixiCompositionProps = z.infer<typeof pixiCompositionSchema>;

export function PixiComposition({
  seed,
  fromFrame,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: PixiCompositionProps) {
  const frame = useCurrentFrame();
  const computeFrame = fromFrame + frame;
  const balls = getBallsAtFrame(seed, computeFrame, width, height);

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 18% 18%, rgba(47, 127, 255, 0.28), transparent 38%), #020817',
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <rect width={width} height={height} fill="#020817" />
        <text
          x={32}
          y={54}
          fill="rgba(238, 244, 255, 0.7)"
          fontFamily="Inter, Arial, sans-serif"
          fontSize={28}
          fontWeight={700}
        >
          seed: {seed} / frame: {computeFrame}
        </text>
        {balls.map((ball) => (
          <circle
            key={ball.id}
            cx={ball.x}
            cy={ball.y}
            r={ball.radius}
            fill={ball.color}
            fillOpacity={0.92}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={3}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
}
