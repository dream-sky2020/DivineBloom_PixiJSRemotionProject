import type { GameObject, Entity, RigidBodyComponent } from '../types';

/**
 * 演示 Behavior：数字循环切换 + 随机物理属性 + 零速冲刺
 */
export class DigitCycleBehavior implements GameObject {
  public readonly entity: Entity;

  constructor(entity: Entity, params: Record<string, any>) {
    this.entity = entity;
  }

  onAwake() {
    console.log(`DigitCycleBehavior awake for entity: ${this.entity.id}`);
  }

  onUpdate(deltaTime: number) {
    // 1. 随机调节摩擦力和质量
    const rigidBody = this.entity.components.get('RigidBody') as RigidBodyComponent | undefined;
    if (rigidBody) {
      // 每一帧都有极小概率突变物理属性
      if (Math.random() < 0.01) {
        rigidBody.friction = Math.random();
        rigidBody.mass = 0.5 + Math.random() * 2.0;
      }

      // 3. 如果速度为 0，突然随机方向加速
      const vx = rigidBody.linearVelocity.x;
      const vy = rigidBody.linearVelocity.y;
      const speedSq = vx * vx + vy * vy;

      if (speedSq < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const force = 300 + Math.random() * 500;
        rigidBody.linearVelocity.x = Math.cos(angle) * force;
        rigidBody.linearVelocity.y = Math.sin(angle) * force;
        console.log(`Entity ${this.entity.id} was stuck, boosting!`);
      }
    }
  }
}
