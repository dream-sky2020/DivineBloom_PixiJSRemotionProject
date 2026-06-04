import { System } from '../../types';
import type { Entity, TimerComponent } from '../../types';

/**
 * 定时器系统：批量处理所有实体的定时逻辑
 */
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

        // 如果配置了信号，可以在这里触发（需要与 SignalSystem 配合）
        if (timer.onCompleteSignal) {
          // 这里可以发送一个内部消息或信号
          // 暂时简单打印，后续可扩展
          console.log(`Timer complete for entity ${entity.id}: ${timer.onCompleteSignal}`);
        }
      }
    }
  }
}
