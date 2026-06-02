import type { Container, Graphics, Particle, ParticleContainer, Sprite, Texture } from 'pixi.js';

export type BlendMode = 'none' | 'normal' | 'add' | 'multiply' | 'subtract' | 'screen';

export type PixiRendererObjectId = string;

export type PixiGraphicObjectKind =
  | 'lineGraphic'
  | 'rectangleGraphic'
  | 'squareGraphic'
  | 'circleGraphic'
  | 'ellipseGraphic'
  | 'polygonGraphic'
  | 'bezierCurveGraphic';

export type PixiRendererObjectKind =
  | 'camera'
  | 'sprite'
  | 'particleContainer'
  | 'particle'
  | PixiGraphicObjectKind;

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
  z?: number;
  focus?: number;
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
  z?: number;
  rotationX?: number;
  rotationY?: number;
}

export interface PixiParticleContainerProps {
  atlas?: string;
  zIndex?: number;
  blendMode?: BlendMode;
  visible?: boolean;
}

export interface PixiParticleProps {
  texture?: PixiTextureSource;
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

export interface PixiGraphicPoint {
  x: number;
  y: number;
}

export interface PixiGraphicStrokeProps {
  color?: string | number;
  alpha?: number;
  width?: number;
}

export interface PixiGraphicFillProps {
  color?: string | number;
  alpha?: number;
}

export interface PixiGraphicDisplayProps {
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
  stroke?: PixiGraphicStrokeProps;
  fill?: PixiGraphicFillProps;
}

export interface PixiLineGraphicProps extends PixiGraphicDisplayProps {
  start: PixiGraphicPoint;
  end: PixiGraphicPoint;
}

export interface PixiRectangleGraphicProps extends PixiGraphicDisplayProps {
  width: number;
  height: number;
  radius?: number;
}

export interface PixiSquareGraphicProps extends PixiGraphicDisplayProps {
  size: number;
  radius?: number;
}

export interface PixiCircleGraphicProps extends PixiGraphicDisplayProps {
  radius: number;
}

export interface PixiEllipseGraphicProps extends PixiGraphicDisplayProps {
  radiusX: number;
  radiusY: number;
}

export interface PixiPolygonGraphicProps extends PixiGraphicDisplayProps {
  points: PixiGraphicPoint[];
}

export type PixiBezierCurvePathCommand =
  | {
    type: 'moveTo';
    point: PixiGraphicPoint;
  }
  | {
    type: 'lineTo';
    point: PixiGraphicPoint;
  }
  | {
    type: 'quadraticCurveTo';
    control: PixiGraphicPoint;
    end: PixiGraphicPoint;
  }
  | {
    type: 'bezierCurveTo';
    control1: PixiGraphicPoint;
    control2: PixiGraphicPoint;
    end: PixiGraphicPoint;
  }
  | {
    type: 'closePath';
  };

export interface PixiBezierCurveGraphicProps extends PixiGraphicDisplayProps {
  path: PixiBezierCurvePathCommand[];
}

export type PixiRendererObjectPropsMap = {
  camera: PixiCameraProps;
  sprite: PixiSpriteProps;
  particleContainer: PixiParticleContainerProps;
  particle: PixiParticleProps;
  lineGraphic: PixiLineGraphicProps;
  rectangleGraphic: PixiRectangleGraphicProps;
  squareGraphic: PixiSquareGraphicProps;
  circleGraphic: PixiCircleGraphicProps;
  ellipseGraphic: PixiEllipseGraphicProps;
  polygonGraphic: PixiPolygonGraphicProps;
  bezierCurveGraphic: PixiBezierCurveGraphicProps;
};

export type PixiFrameStandaloneObjectKind = Exclude<PixiRendererObjectKind, 'particle'>;

export type PixiFrameStandaloneObjectState<
  TObjectKind extends PixiFrameStandaloneObjectKind = PixiFrameStandaloneObjectKind,
> = {
  [TKind in TObjectKind]: {
    id: PixiRendererObjectId;
    kind: TKind;
    props: PixiRendererObjectPropsMap[TKind];
  };
}[TObjectKind];

export interface PixiFrameParticleObjectState {
  id: PixiRendererObjectId;
  kind: 'particle';
  containerId: PixiRendererObjectId;
  props: PixiParticleProps;
}

export type PixiFrameObjectState<
  TObjectKind extends PixiRendererObjectKind = PixiRendererObjectKind,
> = TObjectKind extends 'particle'
  ? PixiFrameParticleObjectState
  : TObjectKind extends PixiFrameStandaloneObjectKind
  ? PixiFrameStandaloneObjectState<TObjectKind>
  : never;

export type PixiFrameStateMap = Map<PixiRendererObjectId, PixiFrameObjectState>;

export type PixiReadonlyFrameStateMap = ReadonlyMap<PixiRendererObjectId, PixiFrameObjectState>;

export interface PixiDoubleBufferedFrameState {
  current: PixiFrameStateMap;
  next: PixiFrameStateMap;
}

export interface PixiReconcilerInput {
  objects: PixiReadonlyFrameStateMap;
}

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

export type PixiParticlePoolEntry = PixiObjectPoolEntry<Particle, 'particle', PixiParticleProps> & {
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

export type PixiLineGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'lineGraphic',
  PixiLineGraphicProps
>;

export type PixiRectangleGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'rectangleGraphic',
  PixiRectangleGraphicProps
>;

export type PixiSquareGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'squareGraphic',
  PixiSquareGraphicProps
>;

export type PixiCircleGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'circleGraphic',
  PixiCircleGraphicProps
>;

export type PixiEllipseGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'ellipseGraphic',
  PixiEllipseGraphicProps
>;

export type PixiPolygonGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'polygonGraphic',
  PixiPolygonGraphicProps
>;

export type PixiBezierCurveGraphicPoolEntry = PixiObjectPoolEntry<
  Graphics,
  'bezierCurveGraphic',
  PixiBezierCurveGraphicProps
>;

export type PixiGraphicPoolEntry =
  | PixiLineGraphicPoolEntry
  | PixiRectangleGraphicPoolEntry
  | PixiSquareGraphicPoolEntry
  | PixiCircleGraphicPoolEntry
  | PixiEllipseGraphicPoolEntry
  | PixiPolygonGraphicPoolEntry
  | PixiBezierCurveGraphicPoolEntry;

export interface PixiPoolBucket<TEntry, TReusableInstance> {
  active: Map<PixiRendererObjectId, TEntry>;
  idle: TReusableInstance[];
}

export interface PixiRendererObjectPool {
  camera?: PixiCameraPoolEntry;
  sprites: PixiPoolBucket<PixiSpritePoolEntry, Sprite>;
  particleContainers: PixiPoolBucket<PixiParticleContainerPoolEntry, ParticleContainer>;
  particleSprites: PixiPoolBucket<PixiParticlePoolEntry, Particle>;
  graphics: PixiPoolBucket<PixiGraphicPoolEntry, Graphics>;
}

export type PixiCreateGraphicCommand =
  | {
    type: 'create';
    kind: 'lineGraphic';
    id: PixiRendererObjectId;
    props: PixiLineGraphicProps;
  }
  | {
    type: 'create';
    kind: 'rectangleGraphic';
    id: PixiRendererObjectId;
    props: PixiRectangleGraphicProps;
  }
  | {
    type: 'create';
    kind: 'squareGraphic';
    id: PixiRendererObjectId;
    props: PixiSquareGraphicProps;
  }
  | {
    type: 'create';
    kind: 'circleGraphic';
    id: PixiRendererObjectId;
    props: PixiCircleGraphicProps;
  }
  | {
    type: 'create';
    kind: 'ellipseGraphic';
    id: PixiRendererObjectId;
    props: PixiEllipseGraphicProps;
  }
  | {
    type: 'create';
    kind: 'polygonGraphic';
    id: PixiRendererObjectId;
    props: PixiPolygonGraphicProps;
  }
  | {
    type: 'create';
    kind: 'bezierCurveGraphic';
    id: PixiRendererObjectId;
    props: PixiBezierCurveGraphicProps;
  };

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
  }
  | PixiCreateGraphicCommand;

export type PixiUpdateGraphicCommand =
  | {
    type: 'update';
    kind: 'lineGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiLineGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'rectangleGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiRectangleGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'squareGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiSquareGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'circleGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiCircleGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'ellipseGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiEllipseGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'polygonGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiPolygonGraphicProps>;
  }
  | {
    type: 'update';
    kind: 'bezierCurveGraphic';
    id: PixiRendererObjectId;
    props: Partial<PixiBezierCurveGraphicProps>;
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
  }
  | PixiUpdateGraphicCommand;

export type PixiDestroyGraphicCommand =
  | {
    type: 'destroy';
    kind: 'lineGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'rectangleGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'squareGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'circleGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'ellipseGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'polygonGraphic';
    id: PixiRendererObjectId;
  }
  | {
    type: 'destroy';
    kind: 'bezierCurveGraphic';
    id: PixiRendererObjectId;
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
  }
  | PixiDestroyGraphicCommand;

export type PixiRendererCommand = PixiCreateCommand | PixiUpdateCommand | PixiDestroyCommand;
