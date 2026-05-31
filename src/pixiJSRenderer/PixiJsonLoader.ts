import type {
  PixiFrameObjectState,
  PixiFrameStateMap,
  PixiRendererObjectKind,
} from './types';
import type { LoadedCanvas } from './PixiXmlLoader';

type SparseKeyframe = [number, unknown];

type JsonTrackObject = {
  kind: string;
  static?: Record<string, unknown>;
  anim?: Record<string, SparseKeyframe[]>;
  dense?: Record<string, unknown[]>;
};

type JsonParticleContainerTrackObject = JsonTrackObject & {
  particles?: Record<string, JsonTrackObject>;
};

type JsonSceneData = {
  meta: {
    name?: string;
    width?: number;
    height?: number;
    fps?: number;
    totalFrames?: number;
  };
  camera?: Record<string, JsonTrackObject>;
  sprites?: Record<string, JsonTrackObject>;
  particleContainers?: Record<string, JsonParticleContainerTrackObject>;
  graphics?: Record<string, JsonTrackObject>;
};

export class PixiJsonLoader {
  static load(jsonString: string): LoadedCanvas {
    let parsed: JsonSceneData;
    try {
      parsed = JSON.parse(jsonString) as JsonSceneData;
    } catch {
      throw new Error('Invalid JSON: parse failed');
    }

    if (!parsed.meta) {
      throw new Error('Invalid JSON: missing meta');
    }

    const canvasProps = {
      name: parsed.meta.name ?? 'Untitled',
      width: Number(parsed.meta.width ?? 1920),
      height: Number(parsed.meta.height ?? 1080),
      fps: Number(parsed.meta.fps ?? 30),
      totalFrames: Number(parsed.meta.totalFrames ?? 0),
    };

    if (!Number.isFinite(canvasProps.totalFrames) || canvasProps.totalFrames <= 0) {
      throw new Error('Invalid JSON: meta.totalFrames must be > 0');
    }

    const frames: PixiFrameStateMap[] = Array.from(
      { length: canvasProps.totalFrames },
      () => new Map(),
    );

    this.parseGroup(parsed.camera, frames);
    this.parseGroup(parsed.sprites, frames);
    this.parseGroup(parsed.graphics, frames);
    this.parseParticleContainers(parsed.particleContainers, frames);

    return { ...canvasProps, frames };
  }

  private static parseGroup(
    group: Record<string, JsonTrackObject> | undefined,
    frames: PixiFrameStateMap[],
    containerId?: string,
  ) {
    if (!group) return;
    for (const [id, track] of Object.entries(group)) {
      this.applyTrack(id, track, frames, containerId);
    }
  }

  private static parseParticleContainers(
    containers: Record<string, JsonParticleContainerTrackObject> | undefined,
    frames: PixiFrameStateMap[],
  ) {
    if (!containers) return;
    for (const [containerId, containerTrack] of Object.entries(containers)) {
      this.applyTrack(containerId, containerTrack, frames);
      if (containerTrack.particles) {
        for (const [particleId, particleTrack] of Object.entries(containerTrack.particles)) {
          this.applyTrack(particleId, particleTrack, frames, containerId);
        }
      }
    }
  }

  private static applyTrack(
    id: string,
    track: JsonTrackObject,
    frames: PixiFrameStateMap[],
    containerId?: string,
  ) {
    const kind = (track.kind || this.inferKind(containerId)) as PixiRendererObjectKind;
    const totalFrames = frames.length;
    const activeByFrame = this.resolveActiveTimeline(track, totalFrames);
    const propsByFrame = this.resolvePropsTimeline(track, totalFrames, kind);

    for (let frame = 0; frame < totalFrames; frame++) {
      if (!activeByFrame[frame]) continue;
      const props = propsByFrame[frame];
      if (!props) continue;

      const objectState: PixiFrameObjectState = {
        id,
        kind,
        props: this.reconstructProps(kind, props),
      } as PixiFrameObjectState;

      if (kind === 'particle' && containerId) {
        (objectState as any).containerId = containerId;
      }
      frames[frame].set(id, objectState);
    }
  }

  private static resolveActiveTimeline(track: JsonTrackObject, totalFrames: number) {
    const active = Array.from({ length: totalFrames }, () => true);

    if (typeof track.static?.active === 'boolean') {
      active.fill(track.static.active);
    }

    const animActive = track.anim?.active;
    if (Array.isArray(animActive)) {
      this.applySparseTrack(active, animActive, totalFrames);
    }

    const denseActive = track.dense?.active;
    if (Array.isArray(denseActive)) {
      for (let i = 0; i < totalFrames; i++) {
        if (typeof denseActive[i] === 'boolean') {
          active[i] = denseActive[i] as boolean;
        }
      }
    }

    return active;
  }

  private static resolvePropsTimeline(
    track: JsonTrackObject,
    totalFrames: number,
    kind: string,
  ): Array<Record<string, unknown> | null> {
    const propsByFrame: Array<Record<string, unknown> | null> = Array.from(
      { length: totalFrames },
      () => ({}),
    );

    const keys = new Set<string>();
    Object.keys(track.static ?? {}).forEach((key) => key !== 'active' && keys.add(key));
    Object.keys(track.anim ?? {}).forEach((key) => key !== 'active' && keys.add(key));
    Object.keys(track.dense ?? {}).forEach((key) => key !== 'active' && keys.add(key));

    for (const key of keys) {
      const values = new Array<unknown>(totalFrames).fill(undefined);

      if (track.static && key in track.static) {
        values.fill(track.static[key]);
      }

      const sparse = track.anim?.[key];
      if (Array.isArray(sparse)) {
        this.applySparseTrack(values, sparse, totalFrames);
      }

      const dense = track.dense?.[key];
      if (Array.isArray(dense)) {
        for (let i = 0; i < totalFrames; i++) {
          const v = dense[i];
          if (v !== null && v !== undefined) {
            values[i] = v;
          }
        }
      }

      for (let i = 0; i < totalFrames; i++) {
        const v = values[i];
        if (v !== undefined) {
          (propsByFrame[i] as Record<string, unknown>)[key] = v;
        }
      }
    }

    // 如果 kind 缺省，给个兜底
    if (!kind) {
      return propsByFrame;
    }

    return propsByFrame;
  }

  private static applySparseTrack(target: unknown[], keyframes: SparseKeyframe[], totalFrames: number) {
    if (keyframes.length === 0) return;
    const sorted = [...keyframes].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length; i++) {
      const [startFrameRaw, value] = sorted[i];
      const [nextFrameRaw] = sorted[i + 1] ?? [totalFrames];
      const startFrame = clampFrame(startFrameRaw, totalFrames);
      const endFrame = clampFrame(nextFrameRaw, totalFrames);
      for (let frame = startFrame; frame < endFrame; frame++) {
        target[frame] = value;
      }
    }
  }

  private static reconstructProps(kind: string, rawProps: Record<string, unknown>) {
    const props: Record<string, unknown> = { ...rawProps };

    if (kind === 'sprite' || kind === 'particle') {
      if (typeof props.image === 'string') {
        props.texture = { kind: 'image', image: props.image };
        delete props.image;
      } else if (typeof props.atlas === 'string' && typeof props.atlasFrame === 'string') {
        props.texture = { kind: 'atlasFrame', atlas: props.atlas, atlasFrame: props.atlasFrame };
        delete props.atlas;
        delete props.atlasFrame;
      }
    }

    if (kind.endsWith('Graphic')) {
      if (props.strokeColor !== undefined || props.strokeAlpha !== undefined || props.strokeWidth !== undefined) {
        props.stroke = {
          color: props.strokeColor,
          alpha: props.strokeAlpha ?? 1,
          width: props.strokeWidth ?? 1,
        };
        delete props.strokeColor;
        delete props.strokeAlpha;
        delete props.strokeWidth;
      }
      if (props.fillColor !== undefined || props.fillAlpha !== undefined) {
        props.fill = {
          color: props.fillColor,
          alpha: props.fillAlpha ?? 1,
        };
        delete props.fillColor;
        delete props.fillAlpha;
      }

      if (kind === 'polygonGraphic' && typeof props.points === 'string') {
        props.points = props.points.split(' ').map((pair) => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y };
        });
      }

      if (kind === 'lineGraphic') {
        if (props.startX !== undefined && props.startY !== undefined) {
          props.start = { x: Number(props.startX), y: Number(props.startY) };
          delete props.startX;
          delete props.startY;
        }
        if (props.endX !== undefined && props.endY !== undefined) {
          props.end = { x: Number(props.endX), y: Number(props.endY) };
          delete props.endX;
          delete props.endY;
        }
      }

      if (kind === 'bezierCurveGraphic' && typeof props.path === 'string') {
        try {
          props.path = JSON.parse(props.path);
        } catch {
          props.path = [];
        }
      }
    }

    return props;
  }

  private static inferKind(containerId?: string): PixiRendererObjectKind {
    return containerId ? 'particle' : 'sprite';
  }
}

function clampFrame(frame: number, totalFrames: number) {
  return Math.max(0, Math.min(totalFrames, Math.floor(frame)));
}
