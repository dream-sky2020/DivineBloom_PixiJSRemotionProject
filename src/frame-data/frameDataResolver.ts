import type { CanvasRenderDocument } from '../dsl/types';
import { frameDataCache } from './frameDataCache';
import type {
  FrameRenderData,
  FrameRenderParticleContainerTask,
  FrameRenderPlan,
  FrameRenderSpriteTask,
  ResolvedParticleContainerFrame,
} from './types';

export function getFrameRenderData(
  document: CanvasRenderDocument,
  currentFrame: number,
): FrameRenderData {
  const safeFrame = Math.max(0, Math.floor(currentFrame));
  const cached = frameDataCache.get(document, safeFrame);
  if (cached) {
    return cached;
  }

  const camera = document.cameras[0];
  const frameData: FrameRenderData = {
    frame: safeFrame,
    camera: camera ? resolveKeyframesAtFrame(camera.keyframes, safeFrame) : {},
    sprites: [],
    particleContainers: [],
  };

  for (const sprite of document.sprites) {
    const props = resolveKeyframesAtFrame(sprite.keyframes, safeFrame);
    if (props.active === false || props.visible === false || Object.keys(props).length === 0) {
      continue;
    }
    frameData.sprites.push({
      ...props,
      id: sprite.id,
      zIndex: props.zIndex ?? 0,
    });
  }

  for (const container of document.particleContainers) {
    const containerProps = resolveKeyframesAtFrame(container.keyframes, safeFrame);
    if (
      containerProps.active === false ||
      containerProps.visible === false ||
      !containerProps.atlas
    ) {
      continue;
    }

    const resolvedContainer: ResolvedParticleContainerFrame = {
      ...containerProps,
      id: container.id,
      atlas: containerProps.atlas,
      zIndex: containerProps.zIndex ?? 0,
      particles: [],
    };

    for (const particle of container.particles) {
      const particleProps = resolveKeyframesAtFrame(particle.keyframes, safeFrame);
      if (particleProps.active === false || Object.keys(particleProps).length === 0) {
        continue;
      }
      resolvedContainer.particles.push({
        ...particleProps,
        id: particle.id,
      });
    }

    frameData.particleContainers.push(resolvedContainer);
  }

  frameDataCache.set(document, safeFrame, frameData);
  return frameData;
}

export function createFrameRenderPlan(frameData: FrameRenderData): FrameRenderPlan {
  const spriteTasks: FrameRenderSpriteTask[] = frameData.sprites.map((sprite) => ({
    kind: 'sprite',
    id: sprite.id,
    zIndex: sprite.zIndex,
    props: sprite,
  }));

  const particleContainerTasks: FrameRenderParticleContainerTask[] = frameData.particleContainers.map(
    (container) => ({
      kind: 'particleContainer',
      id: container.id,
      zIndex: container.zIndex,
      props: container,
    }),
  );

  const tasks = [...spriteTasks, ...particleContainerTasks].sort((a, b) => a.zIndex - b.zIndex);
  return {
    frame: frameData.frame,
    camera: frameData.camera,
    tasks,
  };
}

function resolveKeyframesAtFrame<T extends { frame: number }>(
  keyframes: T[],
  currentFrame: number,
): Partial<T> {
  const sortedFrames = [...keyframes].sort((a, b) => a.frame - b.frame);
  const resolvedProps: Partial<T> = {};

  for (const keyframe of sortedFrames) {
    if (keyframe.frame > currentFrame) {
      break;
    }
    for (const key of Object.keys(keyframe) as Array<keyof T>) {
      const value = keyframe[key];
      if (value !== undefined) {
        resolvedProps[key] = value;
      }
    }
  }

  return resolvedProps;
}

export type { FrameRenderData, FrameRenderPlan };
