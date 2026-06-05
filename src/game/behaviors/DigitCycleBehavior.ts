import type { GameObject, Entity, RigidBodyComponent } from '../types';
import { sendDebugCommand } from '../../debug/DebugLogger';

/**
 * 演示 Behavior：数字循环切换 + 随机物理属性 + 零速冲刺
 */
export class DigitCycleBehavior implements GameObject {
  public readonly entity: Entity;
  public emit?: (signal: string, payload?: any) => void;

  constructor(entity: Entity, _params: Record<string, any>) {
    this.entity = entity;
  }

  onAwake() {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'DigitCycleBehavior',
      message: 'onAwake',
      detail: {
        entityId: this.entity.id,
      },
    });
  }

  onUpdate(deltaTime: number) {
    const rigidBody = this.entity.components.get('RigidBody') as RigidBodyComponent | undefined;
    if (rigidBody) {
      // 1. 随机调节物理属性
      if (Math.random() < 0.01) {
        rigidBody.friction = Math.random();
        rigidBody.mass = 0.5 + Math.random() * 2.0;
        
        // 发送本地信号通知状态改变
        this.emit?.('LOCAL:physics_mutated', { friction: rigidBody.friction, mass: rigidBody.mass });
      }

      // 2. 如果速度为 0，突然随机方向加速
      const vx = rigidBody.linearVelocity.x;
      const vy = rigidBody.linearVelocity.y;
      const speedSq = vx * vx + vy * vy;

      if (speedSq < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const force = 300 + Math.random() * 500;
        rigidBody.linearVelocity.x = Math.cos(angle) * force;
        rigidBody.linearVelocity.y = Math.sin(angle) * force;
        
        sendDebugCommand({
          level: 'DEBUG',
          source: 'DigitCycleBehavior',
          message: 'entity was stuck, boosting',
          detail: {
            entityId: this.entity.id,
            force,
          },
        });
        
        // 发送全局信号，可能触发其他 Prefab 的效果（如相机抖动）
        this.emit?.('GLOBAL:BOOST_TRIGGERED', { entityId: this.entity.id, force });
      }
    }
  }

  onMessage(message: string, payload: any): boolean {
    if (message === 'resetVelocity') {
      const rigidBody = this.entity.components.get('RigidBody') as RigidBodyComponent | undefined;
      if (rigidBody) {
        rigidBody.linearVelocity.x = 0;
        rigidBody.linearVelocity.y = 0;
        sendDebugCommand({
          level: 'DEBUG',
          source: 'DigitCycleBehavior',
          message: 'resetVelocity handled',
          detail: {
            entityId: this.entity.id,
            payload,
          },
        });
      }
      return true;
    }
    return false;
  }
}
