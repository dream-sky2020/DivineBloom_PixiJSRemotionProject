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
export * from './ecs/components/GameObjectController';
export * from './ecs/components/StageDirectorController';
export * from './ecs/systems/PhysicsSystem';
export * from './ecs/systems/RenderSystem';
export * from './ecs/systems/ParticleSystem';
export * from './ecs/systems/AnimationSystem';
export * from './ecs/systems/InputSystem';
export * from './ecs/systems/SignalSystem';
export * from './ecs/systems/GameObjectLifecycleSystem';
export * from './ecs/systems/StageDirectorSystem';

import { World } from './ecs/World';
import { XmlParser } from './parser/XmlParser';
import type { System, WorldData } from './types';

const RECOMMENDED_PIPELINE_ORDER = [
  'InputSystem',
  'SignalSystem',
  'StageDirectorSystem',
  'AnimationSystem',
  'PhysicsSystem',
  'ParticleSystem',
  'GameObjectLifecycleSystem',
  'RenderSystem',
] as const;

const RECOMMENDED_SYSTEM_ORDER_INDEX = new Map<string, number>(
  RECOMMENDED_PIPELINE_ORDER.map((name, index) => [name, index]),
);

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

    const addSystemByName = (name: string): void => {
      const factory = this.systemRegistry.get(name);
      if (!factory) {
        console.warn(`System not registered: ${name}`);
        return;
      }
      const system = factory();
      if (typeof system.configure === 'function') {
        system.configure(worldData.config);
      }
      if (typeof system.bindWorldData === 'function') {
        system.bindWorldData(worldData);
      }
      world.addSystem(system);
    };

    // 1. 初始化系统流水线（统一入口：先补全必需系统，再按推荐管道顺序落位）
    const pipeline = resolvePipelineOrder(worldData);
    for (const systemName of pipeline) {
      addSystemByName(systemName);
    }

    // 2. 初始化实体
    for (const entity of worldData.entities) {
      world.addEntity(entity);
    }
    
    return world;
  }
}

function resolvePipelineOrder(worldData: WorldData): string[] {
  const configuredEnabled = uniquePreservingOrder(
    worldData.config.systems.filter((sys) => sys.enabled).map((sys) => sys.name),
  );
  const required = collectAutoRequiredSystems(worldData);
  const merged = uniquePreservingOrder([...configuredEnabled, ...required]);

  const knownOrdered: string[] = [];
  for (const systemName of RECOMMENDED_PIPELINE_ORDER) {
    if (merged.includes(systemName)) {
      knownOrdered.push(systemName);
    }
  }

  const unknownOrdered = merged.filter((name) => !RECOMMENDED_SYSTEM_ORDER_INDEX.has(name));
  const resolved = [...knownOrdered, ...unknownOrdered];

  const configuredKnownOnly = configuredEnabled.filter((name) =>
    RECOMMENDED_SYSTEM_ORDER_INDEX.has(name),
  );
  const resolvedKnownOnly = resolved.filter((name) => RECOMMENDED_SYSTEM_ORDER_INDEX.has(name));
  if (configuredKnownOnly.join('>') !== resolvedKnownOnly.join('>')) {
    console.warn(
      `[GameEngine] System pipeline normalized to recommended order: ${resolved.join(' -> ')}`,
    );
  }

  return resolved;
}

function collectAutoRequiredSystems(worldData: WorldData): string[] {
  const enabledSet = new Set(
    worldData.config.systems.filter((sys) => sys.enabled).map((sys) => sys.name),
  );
  const required: string[] = [];

  const hasSignalConfigEntity = worldData.entities.some((entity) => entity.components.has('SignalConfig'));
  if (hasSignalConfigEntity && !enabledSet.has('SignalSystem')) {
    required.push('SignalSystem');
  }

  const hasStageDirectorEntity = worldData.entities.some((entity) =>
    entity.components.has('StageDirectorController'),
  );
  if (hasStageDirectorEntity && !enabledSet.has('StageDirectorSystem')) {
    required.push('StageDirectorSystem');
  }

  const hasGameObjectControllerEntity = worldData.entities.some((entity) =>
    entity.components.has('GameObjectController'),
  );
  if (hasGameObjectControllerEntity && !enabledSet.has('GameObjectLifecycleSystem')) {
    required.push('GameObjectLifecycleSystem');
  }

  return required;
}

function uniquePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
