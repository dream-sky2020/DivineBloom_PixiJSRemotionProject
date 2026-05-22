export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;
export const OBJECT_COUNT = 18;

export type BallState = {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
};

const colors = ['#7ee7d9', '#ffce73', '#7fa7ff', '#ff7aa9', '#b08cff', '#8cff9f'];

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function reflectedPosition(value: number, min: number, max: number) {
  const range = max - min;
  if (range <= 0) {
    return min;
  }

  const cycle = range * 2;
  const normalized = ((((value - min) % cycle) + cycle) % cycle);
  return normalized <= range ? min + normalized : max - (normalized - range);
}

export function getBallsAtFrame(
  seed: string,
  frame: number,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
) {
  const random = mulberry32(hashSeed(seed || 'default'));

  return Array.from({ length: OBJECT_COUNT }, (_, id): BallState => {
    const radius = 18 + random() * 34;
    const startX = radius + random() * (width - radius * 2);
    const startY = radius + random() * (height - radius * 2);
    const velocityX = (random() * 2 - 1) * 7;
    const velocityY = (random() * 2 - 1) * 7;

    return {
      id,
      x: reflectedPosition(startX + velocityX * frame, radius, width - radius),
      y: reflectedPosition(startY + velocityY * frame, radius, height - radius),
      radius,
      color: colors[id % colors.length],
    };
  });
}
