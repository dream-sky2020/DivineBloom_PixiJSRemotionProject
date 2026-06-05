import { System } from '../../types';
import type { Entity, BehaviorComponent } from '../../types';
import { GameObjectRegistry } from '../../core/GameObjectRegistry';
import { enqueueSignalEvent } from '../signals/signalRuntime';
import { sendDebugCommand } from '../../../debug/DebugLogger';

export class EcsBehaviorSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
      if (!behavior) continue;

      if (!behavior.instance) {
        try {
          behavior.instance = GameObjectRegistry.create(behavior.behaviorType, entity, behavior.params);
          if (!behavior.instance) {
            sendDebugCommand({
              level: 'ERROR',
              source: 'BehaviorSystem',
              message: 'behavior instance creation returned undefined',
              detail: {
                entityId: entity.id,
                behaviorType: behavior.behaviorType,
                params: behavior.params,
              },
            });
            continue;
          }
          if (behavior.instance) {
            behavior.instance.emit = (signal: string, payload: Record<string, unknown> = {}) => {
              let isGlobal = false;
              let signalName = signal.trim();
              if (signalName.startsWith('GLOBAL:')) {
                isGlobal = true;
                signalName = signalName.slice('GLOBAL:'.length);
              } else if (signalName.startsWith('LOCAL:')) {
                isGlobal = false;
                signalName = signalName.slice('LOCAL:'.length);
              }

              enqueueSignalEvent({
                id: signalName,
                payload,
                isGlobal,
                scopeSelfId: isGlobal ? undefined : String(entity.id),
              });
            };

            if (behavior.instance.onAwake) {
              behavior.instance.onAwake();
            }
          }
        } catch (error) {
          sendDebugCommand({
            level: 'ERROR',
            source: 'BehaviorSystem',
            message: 'failed to create/awake behavior',
            detail: {
              entityId: entity.id,
              behaviorType: behavior.behaviorType,
              params: behavior.params,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          continue;
        }
      }

      if (behavior.instance?.onUpdate) {
        try {
          behavior.instance.onUpdate(deltaTime);
        } catch (error) {
          sendDebugCommand({
            level: 'ERROR',
            source: 'BehaviorSystem',
            message: 'failed to update behavior',
            detail: {
              entityId: entity.id,
              behaviorType: behavior.behaviorType,
              params: behavior.params,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    }
  }
}
