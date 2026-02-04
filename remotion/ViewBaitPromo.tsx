/**
 * ViewBait 60-second promo composition.
 * Uses Series for card sequencing; all animations are frame-based (Remotion best practice).
 * Optional sound effects play at the start of each card when ENABLE_SFX is true and files exist.
 */
import React from 'react';
import {
  AbsoluteFill,
  Series,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
} from 'remotion';
import { Audio } from '@remotion/media';
import { PromoCard } from './PromoCard';
import { CARDS, CARD_DURATIONS_FRAMES } from './cardData';

/** Set to true and add public/sfx/transition.mp3 for a short tick/whoosh per card. */
const ENABLE_SFX = false;
const SFX_FILE = 'sfx/transition.mp3';

export const ViewBaitPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let fromFrame = 0;

  return (
    <AbsoluteFill
      style={{
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Load Inter + Space Mono for Remotion (inline link for compatibility) */}
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <Series>
        {CARDS.map((card, index) => {
          const durationInFrames = CARD_DURATIONS_FRAMES[index];
          const startFrame = fromFrame;
          fromFrame += durationInFrames;

          return (
            <Series.Sequence
              key={index}
              durationInFrames={durationInFrames}
              premountFor={durationInFrames}
            >
              <PromoCard card={card} />
              {ENABLE_SFX && (
                <SequenceSfx fromFrame={0} src={staticFile(SFX_FILE)} volume={0.4} />
              )}
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Progress bar: driven by global composition frame */}
      <ProgressBar frame={frame} />
    </AbsoluteFill>
  );
};

/**
 * Red flash overlay at the start of each card (first ~0.15s).
 */
const ScreenFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 5], [0.8, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#ff0000',
        pointerEvents: 'none',
        zIndex: 200,
        opacity,
      }}
    />
  );
};

/**
 * Plays a short SFX once at the start of the parent Sequence (frame 0 of the sequence).
 */
const SequenceSfx: React.FC<{
  fromFrame: number;
  src: string;
  volume: number;
}> = ({ src, volume }) => {
  return (
    <Audio
      src={src}
      volume={volume}
      // Play only first ~0.2s so it's a short tick/whoosh
      trimAfter={6}
    />
  );
};

/**
 * Progress bar at the bottom. Uses composition frame to show progress across all cards.
 */
const ProgressBar: React.FC<{ frame: number }> = ({ frame }) => {
  const totalFrames = CARD_DURATIONS_FRAMES.reduce((a, b) => a + b, 0);
  const progress = Math.min(1, frame / totalFrames);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'rgba(255,255,255,0.1)',
        zIndex: 101,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: '#ff0000',
          boxShadow: '0 0 10px rgba(255,0,0,0.5)',
        }}
      />
    </div>
  );
};
