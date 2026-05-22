import { Composition } from 'remotion';
import { PixiComposition } from './PixiComposition';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="PixiScene"
        component={PixiComposition}
        durationInFrames={150} // 5 秒 (30fps)
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
