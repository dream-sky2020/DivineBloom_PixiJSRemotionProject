import { Container } from 'pixi.js';
import type { CanvasRenderDocument } from '../dsl/types';
import { createFrameRenderPlan, getFrameRenderData } from '../frame-data/frameDataResolver';
import { PixiDisplayAdapter } from './pixiDisplayAdapter';

export class PixiRenderer {
  private adapter: PixiDisplayAdapter;

  constructor(container: Container) {
    container.sortableChildren = true;
    this.adapter = new PixiDisplayAdapter(container);
  }

  public async render(document: CanvasRenderDocument, currentFrame: number) {
    const frameData = getFrameRenderData(document, currentFrame);
    const plan = createFrameRenderPlan(frameData);
    await this.adapter.renderPlan(plan);
  }
}