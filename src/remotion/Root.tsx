import { Composition, registerRoot } from 'remotion';
import { PixiComposition, pixiCompositionSchema } from './PixiComposition';
import { PixiXmlComposition, pixiXmlSchema } from './PixiXmlComposition';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';

function RemotionRoot() {
  return (
    <>
      <Composition
        id="PixiBounce"
        component={PixiComposition}
        durationInFrames={240}
        fps={60}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        schema={pixiCompositionSchema}
        defaultProps={{
          seed: 'new-world',
          fromFrame: 0,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Number(props.durationInFrames ?? 240)),
          fps: Number(props.fps ?? 60),
          width: Number(props.width ?? DEFAULT_WIDTH),
          height: Number(props.height ?? DEFAULT_HEIGHT),
        })}
      />
      <Composition
        id="PixiXml"
        component={PixiXmlComposition}
        durationInFrames={240}
        fps={60}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        schema={pixiXmlSchema}
        defaultProps={{
          xmlPath: 'temp_render.xml',
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
          fps: 60,
          durationInFrames: 240,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Number(props.durationInFrames ?? 240)),
          fps: Number(props.fps ?? 60),
          width: Number(props.width ?? DEFAULT_WIDTH),
          height: Number(props.height ?? DEFAULT_HEIGHT),
        })}
      />
    </>
  );
}

registerRoot(RemotionRoot);
