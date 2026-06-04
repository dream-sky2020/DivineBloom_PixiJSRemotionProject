import { System } from '../types';
import type { Entity, EntityId, WorldData } from '../types';
import { consumeQueuedDestroyEntityIds } from './lifecycleRuntime';

export class World {
  private entities: Map<EntityId, Entity> = new Map();
  private systems: System[] = [];
  public data?: WorldData;

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  removeEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(deltaTime: number): void {
    const entitiesArray = Array.from(this.entities.values());
    for (const system of this.systems) {
      system.update(entitiesArray, deltaTime);
    }
    for (const id of consumeQueuedDestroyEntityIds()) {
      this.entities.delete(id);
    }
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  clear(): void {
    this.entities.clear();
  }
}
