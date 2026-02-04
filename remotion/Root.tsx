/**
 * Remotion root: registers the ViewBait promo composition (60s, 1080x1920).
 */
import React from 'react';
import { Composition } from 'remotion';
import { ViewBaitPromo } from './ViewBaitPromo';
import { TOTAL_DURATION_FRAMES, FPS_CONFIG } from './cardData';

const WIDTH = 1080;
const HEIGHT = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ViewBaitPromo"
        component={ViewBaitPromo}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={FPS_CONFIG}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};
