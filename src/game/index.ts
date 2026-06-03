export * from './types';
export * from './ecs/World';
export * from './parser/XmlParser';
export * from './ecs/components/Transform';
export * from './ecs/components/Sprite';
export * from './ecs/components/RigidBody';
export * from './ecs/components/CircleCollider';
export * from './ecs/components/PolygonCollider';
export * from './ecs/components/Graphic';
export * from './ecs/components/Camera';
export * from './ecs/components/Canvas';
export * from './ecs/components/ParticleEmitter';
export * from './ecs/components/Animations';
export * from './ecs/components/AnimationController';
export * from './ecs/systems/PhysicsSystem';
export * from './ecs/systems/RenderSystem';
export * from './ecs/systems/ParticleSystem';
export * from './ecs/systems/AnimationSystem';
export * from './ecs/systems/InputSystem';

import { World } from './ecs/World';
import { XmlParser } from './parser/XmlParser';
import type { System } from './types';

/**
 * 游戏引擎初始化工具
 */
export class GameEngine {
  private static systemRegistry: Map<string, () => System> = new Map();

  /**
   * 注册系统工厂函数，以便通过 XML 名称实例化
   */
  static registerSystem(name: string, factory: () => System): void {
    this.systemRegistry.set(name, factory);
  }

  static async createWorldFromXml(xmlString: string): Promise<World> {
    const world = new World();
    const worldData = await XmlParser.parseWorld(xmlString);
    world.data = worldData;
    
    // 1. 初始化系统流水线
    for (const sysConfig of worldData.config.systems) {
      if (sysConfig.enabled) {
        const factory = this.systemRegistry.get(sysConfig.name);
        if (factory) {
          const system = factory();
          if (typeof system.configure === 'function') {
            system.configure(worldData.config);
          }
          world.addSystem(system);
        } else {
          console.warn(`System not registered: ${sysConfig.name}`);
        }
      }
    }

    // 2. 初始化实体
    for (const entity of worldData.entities) {
      world.addEntity(entity);
    }
    
    return world;
  }
}
