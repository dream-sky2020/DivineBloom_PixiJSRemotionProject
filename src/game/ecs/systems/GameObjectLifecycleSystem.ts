import { System } from '../../types';
import type { Entity, BehaviorComponent } from '../../types';
import type { GameObjectControllerComponent } from '../components/GameObjectController';
import { consumeGameObjectControllerActions } from '../components/GameObjectController';
import { queueEntityDestroy } from '../lifecycleRuntime';
import { enqueueSignalEvent } from '../signalRuntime';

export class EcsGameObjectLifecycleSystem extends System {
  update(entities: Entity[], _deltaTime: number): void {
    const now = Date.now();
    for (const entity of entities) {
      const controller = entity.components.get('GameObjectController') as GameObjectControllerComponent | undefined;
      if (!controller) continue;

      const requests = consumeGameObjectControllerActions(controller);
      for (const request of requests) {
        if (request.action !== 'destroy') continue;
        this.handleDestroyRequest(entity, controller, request.args, now);
      }

      if (!controller.alive) {
        const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
        if (behavior?.instance?.onDestroy) {
          behavior.instance.onDestroy();
        }
        queueEntityDestroy(String(entity.id));
        continue;
      }

      if (!controller.pendingDestroy) continue;
      if (controller.destroyAt !== null && now < controller.destroyAt) continue;

      controller.alive = false;
      const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
      if (behavior?.instance?.onDestroy) {
        behavior.instance.onDestroy();
      }
      queueEntityDestroy(String(entity.id));
    }
  }

  private handleDestroyRequest(
    entity: Entity,
    controller: GameObjectControllerComponent,
    args: Record<string, unknown>,
    now: number,
  ): void {
    if (controller.pendingDestroy || !controller.alive) return;
    if (!controller.destroyable) return;

    const delayMs = Math.max(0, toNumber(args.delayMs, controller.destroyDelayMs));
    controller.pendingDestroy = true;
    controller.destroyAt = delayMs > 0 ? now + delayMs : null;
    controller.destroyReason = typeof args.reason === 'string' ? args.reason : controller.destroyReason;

    const emit = typeof args.emit === 'string' ? args.emit.trim() : '';
    if (emit) {
      enqueueSignalEvent({
        id: emit,
        payload: {
          selfId: entity.id,
          reason: controller.destroyReason,
          delayMs,
        },
        scopeSelfId: String(entity.id),
      });
    }
  }
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
