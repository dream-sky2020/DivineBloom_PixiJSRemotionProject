import type { Component } from '../../types';

export interface CanvasComponent extends Component {
  readonly type: 'Canvas';
  /** 场景/任务名称，用于导出与调试 */
  name: string;
  /** 输出画布宽度（像素），影响 Pixi Application 与相机 viewport */
  width: number;
  /** 输出画布高度（像素） */
  height: number;
  /** 可选：Pixi 背景色，对应 ApplicationOptions.background */
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
