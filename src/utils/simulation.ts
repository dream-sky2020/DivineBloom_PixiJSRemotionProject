// 简单的种子随机数生成器
export const createPRNG = (seed: number) => {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const getBallStateAtFrame = (
  frame: number,
  seed: number,
  width: number,
  height: number,
  radius: number = 20
): BallState => {
  const prng = createPRNG(seed);
  
  // 初始位置：中心
  let x = width / 2;
  let y = height / 2;
  
  // 初始速度：基于种子随机生成
  let vx = (prng() * 10 - 5) * 2;
  let vy = (prng() * 10 - 5) * 2;

  // 模拟物理运动
  for (let i = 0; i < frame; i++) {
    x += vx;
    y += vy;

    // 碰撞检测
    if (x + radius > width || x - radius < 0) {
      vx = -vx;
      x = x - radius < 0 ? radius : width - radius;
    }
    if (y + radius > height || y - radius < 0) {
      vy = -vy;
      y = y - radius < 0 ? radius : height - radius;
    }
  }

  return { x, y, vx, vy };
};
