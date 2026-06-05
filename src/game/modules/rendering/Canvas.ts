import type { Component } from '../../types';

export interface CanvasComponent extends Component {
  readonly type: 'Canvas';
  name: string;
  width: number;
  height: number;
  background?: string;
}

export const createCanvas = (
  options: Partial<Omit<CanvasComponent, 'type'>> = {}
): CanvasComponent => ({
  type: 'Canvas',
  name: options.name ?? 'Untitled',
  width: options.width ?? 1920,
  height: options.height ?? 1080,
  background: options.background,
});
