import { Composition, registerRoot } from 'remotion';
import { PixiComposition, pixiCompositionSchema } from './PixiComposition';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';

function RemotionRoot() {
  return (
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
  );
}

registerRoot(RemotionRoot);
