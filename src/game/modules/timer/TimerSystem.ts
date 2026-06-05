import { System } from '../../types';
import type { Entity, TimerComponent } from '../../types';
import { enqueueSignalEvent } from '../signals/signalRuntime';

export class EcsTimerSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const timer = entity.components.get('Timer') as TimerComponent | undefined;
      if (!timer || !timer.active) continue;

      timer.time += deltaTime;
      if (timer.time >= timer.duration) {
        if (timer.loop) {
          timer.time = 0;
        } else {
          timer.active = false;
          timer.time = timer.duration;
        }

        if (timer.onCompleteSignal) {
          let isGlobal = false;
          let signalName = timer.onCompleteSignal.trim();

          if (signalName.startsWith('GLOBAL:')) {
            isGlobal = true;
            signalName = signalName.slice('GLOBAL:'.length);
          } else if (signalName.startsWith('LOCAL:')) {
            isGlobal = false;
            signalName = signalName.slice('LOCAL:'.length);
          }

          enqueueSignalEvent({
            id: signalName,
            payload: { entityId: entity.id, name: entity.name },
            isGlobal,
            scopeSelfId: isGlobal ? undefined : String(entity.id),
          });
        }
      }
    }
  }
}
