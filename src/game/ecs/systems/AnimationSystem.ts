import { System } from '../../types';
import type { Entity, AnimationComponent, AnimationTrack } from '../../types';

/**
 * 动画系统：支持多轨道、关键帧插值的动画系统
 */
export class EcsAnimationSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    const deltaFrames = deltaTime * 60; // 假设 60fps 基准，将秒转为帧数

    for (const entity of entities) {
      const animComp = entity.components.get('Animation') as AnimationComponent | undefined;
      if (!animComp || !animComp.activeLabel) continue;

      const label = animComp.labels.find(l => l.name === animComp.activeLabel);
      if (!label) continue;

      // 更新当前帧
      animComp.currentFrame += deltaFrames * label.speed;

      if (animComp.currentFrame >= label.duration) {
        if (label.loop) {
          animComp.currentFrame %= label.duration;
        } else {
          animComp.currentFrame = label.duration;
          // 播放结束逻辑可选
        }
      }

      // 应用所有轨道
      for (const track of label.tracks) {
        this.applyTrack(entity, track, animComp.currentFrame);
      }
    }
  }

  private applyTrack(entity: Entity, track: AnimationTrack, currentFrame: number): void {
    const keyframes = track.keyframes;
    if (keyframes.length === 0) return;

    let value: any;

    if (keyframes.length === 1 || currentFrame <= keyframes[0].frame) {
      value = keyframes[0].value;
    } else if (currentFrame >= keyframes[keyframes.length - 1].frame) {
      value = keyframes[keyframes.length - 1].value;
    } else {
      // 查找当前帧前后的关键帧
      let i = 0;
      while (i < keyframes.length - 1 && keyframes[i + 1].frame < currentFrame) {
        i++;
      }

      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];

      if (track.interpolation === 'linear' && typeof k1.value === 'number' && typeof k2.value === 'number') {
        const t = (currentFrame - k1.frame) / (k2.frame - k1.frame);
        value = k1.value + (k2.value - k1.value) * t;
      } else {
        // hold 模式或非数值类型
        value = k1.value;
      }
    }

    this.applyProperty(entity, track.property, value);
  }

  private applyProperty(entity: Entity, property: string, value: any): void {
    const parts = property.split('.');
    let target: any = entity.components.get(parts[0]);
    
    if (!target) return;

    for (let i = 1; i < parts.length - 1; i++) {
      target = target[parts[i]];
      if (!target) return;
    }

    const lastProp = parts[parts.length - 1];
    target[lastProp] = value;
  }
}
