import type {
  PixiFrameObjectState,
  PixiReadonlyFrameStateMap,
  PixiRendererObjectId,
  PixiSpriteProps,
  PixiGraphicDisplayProps,
  PixiLineGraphicProps,
  PixiPolygonGraphicProps,
} from './types';

interface CanvasExportProps {
  name: string;
  width: number;
  height: number;
  fps: number;
}

interface JsonExportOptions {
  /** 稀疏轨道阈值（变化率 <= 阈值进入 anim） */
  sparseThreshold?: number;
  /** 数值保留小数位 */
  precision?: number;
}

type SparseKeyframe = [number, unknown];

export interface PixiJsonTrackObject {
  kind: string;
  static: Record<string, unknown>;
  anim: Record<string, SparseKeyframe[]>;
  dense: Record<string, unknown[]>;
}

export interface PixiJsonParticleContainerTrackObject extends PixiJsonTrackObject {
  particles: Record<string, PixiJsonTrackObject>;
}

export interface PixiCompressedJsonExport {
  meta: {
    name: string;
    width: number;
    height: number;
    fps: number;
    totalFrames: number;
  };
  camera: Record<string, PixiJsonTrackObject>;
  sprites: Record<string, PixiJsonTrackObject>;
  particleContainers: Record<string, PixiJsonParticleContainerTrackObject>;
  graphics: Record<string, PixiJsonTrackObject>;
}

const DEFAULT_SPARSE_THRESHOLD = 0.1;
const DEFAULT_PRECISION = 2;

export class PixiJsonExporter {
  static export(
    frames: PixiReadonlyFrameStateMap[],
    canvasProps: CanvasExportProps,
    options: JsonExportOptions = {},
  ): PixiCompressedJsonExport {
    const totalFrames = frames.length;
    const sparseThreshold = clamp01(options.sparseThreshold ?? DEFAULT_SPARSE_THRESHOLD);
    const precision = Math.max(0, options.precision ?? DEFAULT_PRECISION);

    const kinds = new Map<PixiRendererObjectId, string>();
    const particleToContainer = new Map<PixiRendererObjectId, PixiRendererObjectId>();
    const objectFrameProps = new Map<PixiRendererObjectId, Array<Record<string, unknown> | null>>();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const frame = frames[frameIndex];
      frame.forEach((state, id) => {
        kinds.set(id, state.kind);
        if (state.kind === 'particle') {
          particleToContainer.set(id, state.containerId);
        }
        if (!objectFrameProps.has(id)) {
          objectFrameProps.set(id, Array.from({ length: totalFrames }, () => null));
        }
        objectFrameProps.get(id)![frameIndex] = normalizeProps(this.extractProps(state, precision), precision);
      });
    }

    const result: PixiCompressedJsonExport = {
      meta: {
        name: canvasProps.name,
        width: canvasProps.width,
        height: canvasProps.height,
        fps: canvasProps.fps,
        totalFrames,
      },
      camera: {},
      sprites: {},
      particleContainers: {},
      graphics: {},
    };

    for (const [id, kind] of kinds) {
      const track = this.buildTrackObject(kind, objectFrameProps.get(id) ?? [], sparseThreshold);

      if (kind === 'particle') {
        const containerId = particleToContainer.get(id);
        if (!containerId) continue;
        if (!result.particleContainers[containerId]) {
          result.particleContainers[containerId] = {
            kind: 'particleContainer',
            static: {},
            anim: {},
            dense: {},
            particles: {},
          };
        }
        result.particleContainers[containerId].particles[id] = track;
      } else if (kind === 'camera') {
        result.camera[id] = track;
      } else if (kind === 'sprite') {
        result.sprites[id] = track;
      } else if (kind === 'particleContainer') {
        const existing = result.particleContainers[id];
        result.particleContainers[id] = {
          kind: track.kind,
          static: track.static,
          anim: track.anim,
          dense: track.dense,
          particles: existing?.particles ?? {},
        };
      } else if (kind.endsWith('Graphic')) {
        result.graphics[id] = track;
      }
    }

    return result;
  }

  private static buildTrackObject(
    kind: string,
    timeline: Array<Record<string, unknown> | null>,
    sparseThreshold: number,
  ): PixiJsonTrackObject {
    const track: PixiJsonTrackObject = {
      kind,
      static: {},
      anim: {},
      dense: {},
    };

    const activeFrames = timeline.map((props) => props !== null);
    const activeKeyframes = toKeyframes(activeFrames.map((active) => active as unknown));
    if (activeKeyframes.length === 1 && activeKeyframes[0][1] === true) {
      track.static.active = true;
    } else {
      track.anim.active = activeKeyframes;
    }

    const propKeys = new Set<string>();
    for (const props of timeline) {
      if (!props) continue;
      Object.keys(props).forEach((key) => propKeys.add(key));
    }

    const totalFrames = timeline.length;
    const activeCount = activeFrames.reduce((acc, active) => acc + (active ? 1 : 0), 0);
    const sparseMaxChanges = Math.max(1, Math.floor(activeCount * sparseThreshold));

    propKeys.forEach((key) => {
      const values = timeline.map((props) => (props ? props[key] : null));
      const activeValues = values.filter((_, i) => activeFrames[i]);
      if (activeValues.length === 0) return;

      const keyframes = toKeyframes(values);
      if (keyframes.length <= 1) {
        track.static[key] = activeValues[0];
        return;
      }

      const changes = keyframes.length - 1;
      if (changes <= sparseMaxChanges) {
        track.anim[key] = keyframes;
        return;
      }

      const dense = new Array<unknown>(totalFrames);
      for (let i = 0; i < totalFrames; i++) {
        dense[i] = activeFrames[i] ? values[i] : null;
      }
      track.dense[key] = dense;
    });

    return track;
  }

  private static extractProps(state: PixiFrameObjectState, precision: number): Record<string, unknown> {
    const props: Record<string, unknown> = { ...(state.props as Record<string, unknown>) };

    if (state.kind === 'sprite' && (state.props as PixiSpriteProps).texture) {
      const tex = (state.props as PixiSpriteProps).texture!;
      if (tex.kind === 'image') {
        props.image = tex.image;
      } else {
        props.atlas = tex.atlas;
        props.atlasFrame = tex.atlasFrame;
      }
      delete props.texture;
    }

    if (state.kind.endsWith('Graphic')) {
      const gProps = state.props as PixiGraphicDisplayProps;
      if (gProps.stroke) {
        props.strokeColor = gProps.stroke.color;
        props.strokeAlpha = gProps.stroke.alpha;
        props.strokeWidth = gProps.stroke.width;
        delete props.stroke;
      }
      if (gProps.fill) {
        props.fillColor = gProps.fill.color;
        props.fillAlpha = gProps.fill.alpha;
        delete props.fill;
      }

      if (state.kind === 'polygonGraphic') {
        const pProps = state.props as PixiPolygonGraphicProps;
        props.points = pProps.points.map((p) => `${roundNumber(p.x, precision)},${roundNumber(p.y, precision)}`).join(' ');
      }

      if (state.kind === 'lineGraphic') {
        const lProps = state.props as PixiLineGraphicProps;
        if (lProps.start) {
          props.startX = lProps.start.x;
          props.startY = lProps.start.y;
          delete props.start;
        }
        if (lProps.end) {
          props.endX = lProps.end.x;
          props.endY = lProps.end.y;
          delete props.end;
        }
      }

      if (state.kind === 'bezierCurveGraphic' && props.path !== undefined) {
        props.path = JSON.stringify(normalizeValue(props.path, precision));
      }
    }

    return props;
  }
}

function toKeyframes(values: unknown[]): SparseKeyframe[] {
  const keyframes: SparseKeyframe[] = [];
  let previous: unknown = Symbol('unset');

  for (let frame = 0; frame < values.length; frame++) {
    const value = values[frame];
    if (keyframes.length === 0 || !isDeepEqual(value, previous)) {
      keyframes.push([frame, value]);
      previous = value;
    }
  }
  return keyframes;
}

function normalizeProps(props: Record<string, unknown>, precision: number): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    normalized[key] = normalizeValue(value, precision);
  }
  return normalized;
}

function normalizeValue(value: unknown, precision: number): unknown {
  if (typeof value === 'number') {
    return roundNumber(value, precision);
  }
  if (Array.isArray(value)) {
    return value.map((child) => normalizeValue(child, precision));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeValue(child, precision);
    }
    return result;
  }
  return value;
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, idx) => isDeepEqual(value, right[idx]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
    for (const key of keys) {
      if (!isDeepEqual(leftObj[key], rightObj[key])) return false;
    }
    return true;
  }
  return false;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundNumber(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
