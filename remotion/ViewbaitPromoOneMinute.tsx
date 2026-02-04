import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { PromoCardFull } from "./PromoCardFull";
import { PROMO_CARDS_FULL } from "./promo-copy-full";

const FPS = 30;
const DURATION_SECONDS = 60;
const TOTAL_FRAMES = FPS * DURATION_SECONDS;
const NUM_CARDS = PROMO_CARDS_FULL.length;
const NUM_TRANSITIONS = NUM_CARDS - 1;
const TRANSITION_FRAMES = 12;
/** So that total = NUM_CARDS * FRAMES_PER_CARD - NUM_TRANSITIONS * TRANSITION_FRAMES === 60s */
const FRAMES_PER_CARD = Math.round(
  (TOTAL_FRAMES + NUM_TRANSITIONS * TRANSITION_FRAMES) / NUM_CARDS
);

const TRANSITION_PRESENTATIONS = [
  () => fade(),
  () => slide({ direction: "from-right" }),
  () => wipe(),
  () => slide({ direction: "from-bottom" }),
  () => flip(),
  () => clockWipe(),
  () => slide({ direction: "from-left" }),
  () => fade(),
  () => slide({ direction: "from-top" }),
  () => wipe(),
  () => slide({ direction: "from-right" }),
  () => flip(),
  () => clockWipe(),
  () => slide({ direction: "from-bottom" }),
  () => fade(),
  () => wipe(),
  () => slide({ direction: "from-left" }),
  () => flip(),
  () => clockWipe(),
  () => slide({ direction: "from-top" }),
  () => fade(),
  () => wipe(),
  () => slide({ direction: "from-right" }),
  () => flip(),
  () => clockWipe(),
  () => slide({ direction: "from-bottom" }),
  () => fade(),
  () => slide({ direction: "from-left" }),
  () => wipe(),
];

const getTransition = (index: number) =>
  TRANSITION_PRESENTATIONS[index % TRANSITION_PRESENTATIONS.length];

const USE_SPRING: boolean[] = [
  false,
  true,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  false,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  false,
];

/**
 * One-minute ViewBait promo: 30 cards with transitions, ~60s total.
 * Optional SFX: place public/sfx/click.mp3 for a subtle tick per card change.
 */
export const ViewbaitPromoOneMinute = () => {
  return (
    <AbsoluteFill style={{ background: "#030303" }}>
      <TransitionSeries>
        {PROMO_CARDS_FULL.map((card, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence
              durationInFrames={FRAMES_PER_CARD}
              layout="none"
            >
              <AbsoluteFill>
                <PromoCardFull card={card} index={i} />
              </AbsoluteFill>
            </TransitionSeries.Sequence>
            {i < NUM_CARDS - 1 && (
              <TransitionSeries.Transition
                presentation={getTransition(i)()}
                timing={
                  USE_SPRING[i % USE_SPRING.length]
                    ? springTiming({
                        config: { damping: 200 },
                        durationInFrames: TRANSITION_FRAMES,
                      })
                    : linearTiming({ durationInFrames: TRANSITION_FRAMES })
                }
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* Optional SFX: one short click at the start of each card. Add public/sfx/click.mp3 to enable. */}
      {PROMO_CARDS_FULL.map((_, i) => (
        <Sequence
          key={`sfx-${i}`}
          from={i * FRAMES_PER_CARD - i * TRANSITION_FRAMES}
          durationInFrames={1}
        >
          <SfxClick />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Set to true and add public/sfx/click.mp3 for a subtle tick on each card change. */
const ENABLE_SFX = false;

/** Plays a short click at card change. Add public/sfx/click.mp3 (short tick, ~50–150 ms). */
function SfxClick() {
  if (!ENABLE_SFX) return null;
  return (
    <Audio
      src={staticFile("sfx/click.mp3")}
      volume={0.35}
      name="Card click"
    />
  );
}

/** Total duration in frames for 60s at 30fps (transitions overlap). */
export const VIEWBAIT_PROMO_ONE_MINUTE_DURATION_IN_FRAMES =
  NUM_CARDS * FRAMES_PER_CARD - NUM_TRANSITIONS * TRANSITION_FRAMES;
