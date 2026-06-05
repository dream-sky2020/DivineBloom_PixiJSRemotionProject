import { System } from '../../types';
import type { Entity, AnimationComponent, AnimationTrack } from '../../types';

export class EcsAnimationSystem extends System {
  update(entities: Entity[], deltaTime: number): void {
    const deltaFrames = deltaTime * 60;

    for (const entity of entities) {
      const animComp = entity.components.get('Animation') as AnimationComponent | undefined;
      if (!animComp || !animComp.activeLabel) continue;

      const label = animComp.labels.find(l => l.name === animComp.activeLabel);
      if (!label) continue;

      animComp.currentFrame += deltaFrames * label.speed;

      if (animComp.currentFrame >= label.duration) {
        if (label.loop) {
          animComp.currentFrame %= label.duration;
        } else {
          animComp.currentFrame = label.duration;
        }
      }

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
