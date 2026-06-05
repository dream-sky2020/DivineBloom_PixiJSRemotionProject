import type { Entity, GameObject } from '../types';
import { sendDebugCommand } from '../../debug/DebugLogger';

export type GameObjectFactory = (entity: Entity, params: Record<string, any>) => GameObject;

/**
 * GameObject 注册表，用于将 XML 中的 behavior 类型映射到代码实现
 */
export class GameObjectRegistry {
  private static factories: Map<string, GameObjectFactory> = new Map();

  /**
   * 注册一个 GameObject 工厂函数
   */
  static register(type: string, factory: GameObjectFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * 创建一个 GameObject 实例
   */
  static create(type: string, entity: Entity, params: Record<string, any>): GameObject | undefined {
    const factory = this.factories.get(type);
    if (!factory) {
      sendDebugCommand({
        level: 'ERROR',
        source: 'GameObjectRegistry',
        message: 'GameObject type not registered',
        detail: {
          type,
          entityId: entity.id,
          params,
          availableTypes: Array.from(this.factories.keys()),
        },
      });
      return undefined;
    }
    return factory(entity, params);
  }
}
