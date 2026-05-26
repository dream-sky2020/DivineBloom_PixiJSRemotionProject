/**
 * 渲染 DSL 结构化数据定义，对应 public/doc/rendering_data_structures.txt。
 */

export type BlendMode = 'none' | 'normal' | 'add' | 'multiply' | 'subtract' | 'screen';

export interface SpriteData {
  type: 'sprite';
  id: string;
  atlas?: string;
  frame?: string;
  image?: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  zIndex: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  visible: boolean;
  blendMode: BlendMode;
  tint: number;
}

/**
 * 挂载在 PARTICLECONTAINER 下的单个粒子单元。
 */
export interface ParticleData {
  type: 'particle';
  id: string;
  particleContainer: string;
  frame: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
  rotation: number;
  alpha: number;
  tint: number;
}

/**
 * 高性能粒子渲染容器，同一容器内的粒子共享 atlas。
 */
export interface ParticleContainerData {
  type: 'particleContainer';
  id: string;
  atlas: string;
  zIndex: number;
  blendMode: BlendMode;
  particles: ParticleData[];
}

export type RenderObject =
  | { type: 'sprite'; data: SpriteData }
  | { type: 'particleContainer'; data: ParticleContainerData };

export interface SceneFrame {
  id: string;
  cameraX: number;
  cameraY: number;
  objects: RenderObject[];
}

export interface ImageRenderDocument {
  type: 'image';
  name: string;
  width: number;
  height: number;
  transparent: boolean;
  frames: SceneFrame[];
}

export interface VideoRenderDocument {
  type: 'video';
  name: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  frames: SceneFrame[];
}

export type RenderDocument = ImageRenderDocument | VideoRenderDocument;
