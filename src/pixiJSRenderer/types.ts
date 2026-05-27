import type { Container, ParticleContainer, Sprite, Texture } from 'pixi.js';
import type { BlendMode } from '../dsl/types';

export type PixiRendererObjectId = string;

export type PixiRendererObjectKind = 'camera' | 'sprite' | 'particleContainer' | 'particle';

export type PixiTextureSource =
  | {
      kind: 'image';
      image: string;
    }
  | {
      kind: 'atlasFrame';
      atlas: string;
      atlasFrame: string;
    };

export interface PixiCameraProps {
  x?: number;
  y?: number;
}

export interface PixiSpriteProps {
  texture?: PixiTextureSource;
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
  tint?: string | number;
}

export interface PixiParticleContainerProps {
  atlas?: string;
  zIndex?: number;
  blendMode?: BlendMode;
  visible?: boolean;
}

export interface PixiParticleProps {
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
}

export type PixiRendererObjectPropsMap = {
  camera: PixiCameraProps;
  sprite: PixiSpriteProps;
  particleContainer: PixiParticleContainerProps;
  particle: PixiParticleProps;
};

export interface PixiObjectPoolEntry<
  TObject,
  TObjectKind extends PixiRendererObjectKind,
  TProps,
> {
  id: PixiRendererObjectId;
  kind: TObjectKind;
  instance: TObject;
  props: TProps;
}

export type PixiCameraPoolEntry = PixiObjectPoolEntry<Container, 'camera', PixiCameraProps>;

export type PixiSpritePoolEntry = PixiObjectPoolEntry<Sprite, 'sprite', PixiSpriteProps> & {
  texture?: Texture;
};

export type PixiParticlePoolEntry = PixiObjectPoolEntry<Sprite, 'particle', PixiParticleProps> & {
  containerId: PixiRendererObjectId;
  texture?: Texture;
};

export type PixiParticleContainerPoolEntry = PixiObjectPoolEntry<
  ParticleContainer,
  'particleContainer',
  PixiParticleContainerProps
> & {
  particles: Map<PixiRendererObjectId, PixiParticlePoolEntry>;
};

export interface PixiPoolBucket<TEntry, TReusableInstance> {
  active: Map<PixiRendererObjectId, TEntry>;
  idle: TReusableInstance[];
}

export interface PixiRendererObjectPool {
  camera?: PixiCameraPoolEntry;
  sprites: PixiPoolBucket<PixiSpritePoolEntry, Sprite>;
  particleContainers: PixiPoolBucket<PixiParticleContainerPoolEntry, ParticleContainer>;
  particleSprites: PixiPoolBucket<PixiParticlePoolEntry, Sprite>;
}

export type PixiCreateCommand =
  | {
      type: 'create';
      kind: 'camera';
      id: PixiRendererObjectId;
      props: PixiCameraProps;
    }
  | {
      type: 'create';
      kind: 'sprite';
      id: PixiRendererObjectId;
      props: PixiSpriteProps;
    }
  | {
      type: 'create';
      kind: 'particleContainer';
      id: PixiRendererObjectId;
      props: PixiParticleContainerProps;
    }
  | {
      type: 'create';
      kind: 'particle';
      id: PixiRendererObjectId;
      containerId: PixiRendererObjectId;
      props: PixiParticleProps;
    };

export type PixiUpdateCommand =
  | {
      type: 'update';
      kind: 'camera';
      id: PixiRendererObjectId;
      props: Partial<PixiCameraProps>;
    }
  | {
      type: 'update';
      kind: 'sprite';
      id: PixiRendererObjectId;
      props: Partial<PixiSpriteProps>;
    }
  | {
      type: 'update';
      kind: 'particleContainer';
      id: PixiRendererObjectId;
      props: Partial<PixiParticleContainerProps>;
    }
  | {
      type: 'update';
      kind: 'particle';
      id: PixiRendererObjectId;
      containerId: PixiRendererObjectId;
      props: Partial<PixiParticleProps>;
    };

export type PixiDestroyCommand =
  | {
      type: 'destroy';
      kind: 'camera';
      id: PixiRendererObjectId;
    }
  | {
      type: 'destroy';
      kind: 'sprite';
      id: PixiRendererObjectId;
    }
  | {
      type: 'destroy';
      kind: 'particleContainer';
      id: PixiRendererObjectId;
      destroyParticles?: boolean;
    }
  | {
      type: 'destroy';
      kind: 'particle';
      id: PixiRendererObjectId;
      containerId: PixiRendererObjectId;
    };

export type PixiRendererCommand = PixiCreateCommand | PixiUpdateCommand | PixiDestroyCommand;
