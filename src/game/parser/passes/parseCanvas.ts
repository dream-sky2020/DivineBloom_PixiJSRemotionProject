import type { CanvasComponent } from '../../types';
import { getDirectChildByTag } from '../xml/XmlDom';

export function parseCanvas(worldEl: Element): CanvasComponent | undefined {
  const canvasEl = getDirectChildByTag(worldEl, 'Canvas');
  if (!canvasEl) return undefined;

  return {
    type: 'Canvas',
    name: canvasEl.getAttribute('name') || 'Untitled',
    width: parseFloat(canvasEl.getAttribute('width') || '1920'),
    height: parseFloat(canvasEl.getAttribute('height') || '1080'),
    background: canvasEl.getAttribute('background') || undefined,
  };
}
