import type {
  BlendMode,
  CameraKeyframe,
  ParticleContainerKeyframe,
  ParticleKeyframe,
  SpriteKeyframe,
} from '../dsl/types';

export type ResolvedCameraFrame = Partial<CameraKeyframe>;
export type ResolvedSpriteFrame = Partial<SpriteKeyframe> & { id: string; zIndex: number };
export type ResolvedParticleFrame = Partial<ParticleKeyframe> & { id: string };
export type ResolvedParticleContainerFrame = Partial<ParticleContainerKeyframe> & {
  id: string;
  atlas: string;
  zIndex: number;
  particles: ResolvedParticleFrame[];
};

export type FrameRenderData = {
  frame: number;
  camera: ResolvedCameraFrame;
  sprites: ResolvedSpriteFrame[];
  particleContainers: ResolvedParticleContainerFrame[];
};

export type FrameRenderSpriteTask = {
  kind: 'sprite';
  id: string;
  zIndex: number;
  props: ResolvedSpriteFrame;
};

export type FrameRenderParticleContainerTask = {
  kind: 'particleContainer';
  id: string;
  zIndex: number;
  props: ResolvedParticleContainerFrame;
};

export type FrameRenderTask = FrameRenderSpriteTask | FrameRenderParticleContainerTask;

export type FrameRenderPlan = {
  frame: number;
  camera: ResolvedCameraFrame;
  tasks: FrameRenderTask[];
};

export const DEFAULT_BLEND_MODE: BlendMode = 'normal';
