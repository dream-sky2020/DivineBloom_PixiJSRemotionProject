import type { Component } from '../../types';
import type { BlendMode, PixiTextureSource } from '../../../pixiJSRenderer/types';

export interface SpriteComponent extends Component {
  readonly type: 'Sprite';
  texture: PixiTextureSource;
  anchor: { x: number; y: number };
  alpha: number;
  visible: boolean;
  blendMode: BlendMode;
  tint: number;
  layer: number;
}

export const createSprite = (
  texture: string | PixiTextureSource,
  layer = 0,
  options: Partial<Omit<SpriteComponent, 'type' | 'texture' | 'layer'>> = {}
): SpriteComponent => ({
  type: 'Sprite',
  texture: typeof texture === 'string' ? { kind: 'image', image: texture } : texture,
  anchor: options.anchor ?? { x: 0.5, y: 0.5 },
  alpha: options.alpha ?? 1,
  visible: options.visible ?? true,
  blendMode: options.blendMode ?? 'normal',
  tint: options.tint ?? 0xFFFFFF,
  layer
});
