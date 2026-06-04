import { System } from '../../types';
import type { Entity, BehaviorComponent } from '../../types';
import { GameObjectRegistry } from '../../GameObjectRegistry';

/**
 * 行为系统：负责管理和更新自定义 GameObject 行为
 */
export class EcsBehaviorSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
      if (!behavior) continue;

      // 如果实例尚未创建，则根据注册表创建
      if (!behavior.instance) {
        behavior.instance = GameObjectRegistry.create(behavior.behaviorType, entity, behavior.params);
        if (behavior.instance?.onAwake) {
          behavior.instance.onAwake();
        }
      }

      // 执行每帧更新
      if (behavior.instance?.onUpdate) {
        behavior.instance.onUpdate(deltaTime);
      }
    }
  }

  // 注意：销毁逻辑通常在 GameObjectLifecycleSystem 中处理，
  // 但我们可能需要在这里处理 behavior.instance.onDestroy()
  // 或者在 LifecycleSystem 中增加对 BehaviorComponent 的支持
}
