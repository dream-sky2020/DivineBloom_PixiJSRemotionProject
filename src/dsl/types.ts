/**
 * 渲染 DSL 结构化数据定义，对应最新的渲染引擎数据结构规范。
 * 数据结构已从 "Frame -> Object" 翻转为 "Object -> Keyframe"。
 */

export type BlendMode = 'none' | 'normal' | 'add' | 'multiply' | 'subtract' | 'screen';

// ==========================================
// 关键帧数据结构定义
// ==========================================

export interface CameraKeyframe {
  frame: number;
  x?: number;
  y?: number;
}

export interface SpriteKeyframe {
  frame: number;
  atlas?: string;
  atlasFrame?: string;
  image?: string;
  x?: number;
  y?: number;
  anchorX?: number;
  anchorY?: number;
  zIndex?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  alpha?: number;
  visible?: boolean;
  blendMode?: BlendMode;
  tint?: string | number; // 兼容 XML 中的 "0xffffff" 字符串与解析后的数值
  active?: boolean;
}

export interface ParticleContainerKeyframe {
  frame: number;
  atlas?: string;
  zIndex?: number;
  blendMode?: BlendMode;
  visible?: boolean;
  active?: boolean;
}

export interface ParticleKeyframe {
  frame: number;
  atlasFrame?: string;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  anchorX?: number;
  anchorY?: number;
  rotation?: number;
  alpha?: number;
  tint?: string | number;
  active?: boolean;
}

// ==========================================
// 渲染实体数据结构定义
// ==========================================

export interface CameraData {
  type: 'camera';
  id: string;
  keyframes: CameraKeyframe[];
}

export interface SpriteData {
  type: 'sprite';
  id: string;
  keyframes: SpriteKeyframe[];
}

export interface ParticleData {
  type: 'particle';
  id: string;
  keyframes: ParticleKeyframe[];
}

export interface ParticleContainerData {
  type: 'particleContainer';
  id: string;
  keyframes: ParticleContainerKeyframe[];
  particles: ParticleData[]; // 容器内部挂载的粒子集合
}

// ==========================================
// 根节点数据结构定义
// ==========================================

/**
 * 统一的根节点渲染文档，替代旧版的 VideoRenderDocument / ImageRenderDocument
 */
export interface CanvasRenderDocument {
  type: 'canvas';
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  totalFrames?: number;
  
  // 实体集合
  cameras: CameraData[];
  sprites: SpriteData[];
  particleContainers: ParticleContainerData[];
}