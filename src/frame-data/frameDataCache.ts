import type { CanvasRenderDocument } from '../dsl/types';
import type { FrameRenderData } from './types';

const DEFAULT_MAX_CACHE_FRAMES = 300;

type DocumentFrameCache = {
  frames: Map<number, FrameRenderData>;
};

export class FrameDataCache {
  private readonly maxFramesPerDocument: number;
  private cache = new WeakMap<CanvasRenderDocument, DocumentFrameCache>();

  constructor(maxFramesPerDocument = DEFAULT_MAX_CACHE_FRAMES) {
    this.maxFramesPerDocument = Math.max(1, Math.floor(maxFramesPerDocument));
  }

  public get(document: CanvasRenderDocument, frame: number) {
    return this.cache.get(document)?.frames.get(frame);
  }

  public set(document: CanvasRenderDocument, frame: number, data: FrameRenderData) {
    const normalizedFrame = Math.max(0, Math.floor(frame));
    let documentCache = this.cache.get(document);
    if (!documentCache) {
      documentCache = { frames: new Map<number, FrameRenderData>() };
      this.cache.set(document, documentCache);
    }

    if (documentCache.frames.has(normalizedFrame)) {
      documentCache.frames.set(normalizedFrame, data);
      return;
    }

    documentCache.frames.set(normalizedFrame, data);
    if (documentCache.frames.size <= this.maxFramesPerDocument) {
      return;
    }

    const oldestFrame = documentCache.frames.keys().next().value;
    if (oldestFrame !== undefined) {
      documentCache.frames.delete(oldestFrame);
    }
  }

  public clearDocument(document: CanvasRenderDocument) {
    this.cache.delete(document);
  }

  public clearAll() {
    this.cache = new WeakMap();
  }
}

export const frameDataCache = new FrameDataCache();
