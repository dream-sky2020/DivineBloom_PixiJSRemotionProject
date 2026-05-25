/**
 * 结构化渲染数据定义 - 深度适配 PixiJS 属性
 */

export interface Point {
  x: number;
  y: number;
}

export interface TextData {
  type: 'text';
  text: string;
  x: number;
  y: number;
  anchor?: Point;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fill?: string | number;
    align?: 'left' | 'center' | 'right';
    fontWeight?: string;
    stroke?: string | number;
    strokeThickness?: number;
    dropShadow?: boolean;
    dropShadowColor?: string | number;
    wordWrap?: boolean;
    wordWrapWidth?: number;
  };
  alpha?: number;
  rotation?: number;
  scale?: Point;
  visible?: boolean;
}

export interface SpriteData {
  type: 'sprite';
  assetUrl: string;
  x: number;
  y: number;
  anchor?: Point;
  width?: number;
  height?: number;
  scale?: Point;
  rotation?: number;
  tint?: number; // PixiJS tint 通常使用十六进制数字
  alpha?: number;
  visible?: boolean;
  blendMode?: 'normal' | 'add' | 'multiply' | 'screen';
}

/**
 * 单个粒子的数据定义
 */
export interface ParticleItem {
  x: number;
  y: number;
  frame?: string | number; // 子图名称（对应 Spritesheet 中的 key）或索引
  scale?: number;
  rotation?: number;
  alpha?: number;
  tint?: number;
}

/**
 * 粒子容器数据定义 - 对应 PixiJS 的 ParticleContainer
 */
export interface ParticleContainerData {
  type: 'particleContainer';
  assetUrl: string; // 粒子容器通常所有粒子共用一个纹理
  maxCount?: number;
  properties?: {
    scale?: boolean;
    position?: boolean;
    rotation?: boolean;
    uvs?: boolean;
    alpha?: boolean;
    tint?: boolean;
  };
  particles: ParticleItem[];
}

export type RenderObject = 
  | { type: 'text'; data: TextData }
  | { type: 'sprite'; data: SpriteData }
  | { type: 'particleContainer'; data: ParticleContainerData };

export interface SceneFrame {
  objects: RenderObject[];
}
