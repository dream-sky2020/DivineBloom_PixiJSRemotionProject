import type { Component } from '../../types';
import type { PixiGraphicObjectKind, PixiGraphicStrokeProps, PixiGraphicFillProps } from '../../../pixiJSRenderer/types';

export interface GraphicComponent extends Component {
  readonly type: 'Graphic';
  kind: PixiGraphicObjectKind;
  fill?: PixiGraphicFillProps;
  stroke?: PixiGraphicStrokeProps;
  alpha?: number;
  // 形状特定属性
  width?: number;
  height?: number;
  radius?: number;
  points?: { x: number; y: number }[];
}

export const createGraphic = (
  kind: PixiGraphicObjectKind,
  options: Partial<Omit<GraphicComponent, 'type' | 'kind'>> = {}
): GraphicComponent => ({
  type: 'Graphic',
  kind,
  ...options
});
