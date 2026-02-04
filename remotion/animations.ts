/**
 * Frame-based animation helpers for Remotion (no CSS animations).
 * All take local frame and fps; optional delay/duration in frames.
 */
import { interpolate, spring, Easing } from 'remotion';

const DEFAULT_DURATION = 15; // ~0.5s at 30fps

export function slamIn(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.5 * fps);
  const progress = Math.min(1, t / duration);
  const y = interpolate(progress, [0, 0.6, 0.8, 1], [-100, 20, -10, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  });
  const scale = interpolate(progress, [0, 0.6, 1], [1.5, 1, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const opacity = interpolate(progress, [0, 0.6], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `translateY(${y}px) scale(${scale})`, opacity };
}

export function slideBottom(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.5 * fps);
  const progress = Math.min(1, t / duration);
  const y = interpolate(progress, [0, 1], [50, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `translateY(${y}px)`, opacity };
}

export function scalePop(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.6 * fps);
  const progress = Math.min(1, t / duration);
  const scale = interpolate(progress, [0, 0.5, 0.7, 1], [0, 1.2, 0.9, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  });
  const opacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `scale(${scale})`, opacity };
}

export function zoomPulse(frame: number, fps: number, offset = 0) {
  const t = (frame + offset) % (1 * fps);
  const scale = interpolate(t, [0, 0.5 * fps], [1, 1.05], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  return scale;
}

export function blurIn(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.5 * fps);
  const progress = Math.min(1, t / duration);
  const blur = interpolate(progress, [0, 1], [20, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { filter: `blur(${blur}px)`, opacity };
}

export function glitchReveal(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.6 * fps);
  const progress = Math.min(1, t / duration);
  const clip = interpolate(progress, [0, 0.2, 0.4, 0.6, 0.8, 1], [100, 80, 40, 20, 5, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const x = interpolate(progress, [0, 0.2, 0.4, 0.6, 0.8, 1], [-20, 10, -5, 5, -2, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { clipPath: `inset(0 ${clip}% 0 0)`, transform: `translateX(${x}px)` };
}

export function bouncePop(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.5 * fps);
  const progress = Math.min(1, t / duration);
  const scale = interpolate(progress, [0, 0.5, 0.7, 1], [0, 1.3, 0.9, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  });
  const opacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `scale(${scale})`, opacity };
}

export function heartbeat(frame: number, fps: number, offset = 0) {
  const t = (frame + offset) % (1 * fps);
  const scale = interpolate(t, [0, 0.14 * fps, 0.28 * fps, 0.42 * fps, 0.7 * fps], [1, 1.15, 1, 1.15, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  return scale;
}

export function wobble(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.8 * fps);
  if (t < 0 || t > duration) return { transform: 'translateX(0) rotate(0deg)' };
  const x = interpolate(
    t,
    [0, 0.15 * duration, 0.3 * duration, 0.45 * duration, 0.6 * duration, 0.75 * duration, duration],
    [0, -15, 12, -9, 6, -3, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  const rot = interpolate(
    t,
    [0, 0.15 * duration, 0.3 * duration, 0.45 * duration, 0.6 * duration, duration],
    [0, -5, 3, -3, 2, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  return { transform: `translateX(${x}px) rotate(${rot}deg)` };
}

export function drawLine(frame: number, fps: number, delay = 0, durationFrames?: number) {
  const t = frame - delay;
  const duration = durationFrames ?? Math.round(0.8 * fps);
  const progress = Math.min(1, t / duration);
  return progress;
}

export function slideLeft(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.4 * fps);
  const progress = Math.min(1, t / duration);
  const x = interpolate(progress, [0, 1], [-100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `translateX(${x}px)`, opacity };
}

export function slideRight(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.4 * fps);
  const progress = Math.min(1, t / duration);
  const x = interpolate(progress, [0, 1], [100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `translateX(${x}px)`, opacity };
}

export function slideUpBounce(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.6 * fps);
  const progress = Math.min(1, t / duration);
  const y = interpolate(progress, [0, 0.6, 0.8, 1], [100, -20, 10, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const opacity = interpolate(progress, [0, 0.6], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `translateY(${y}px)`, opacity };
}

export function rotateIn(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.5 * fps);
  const progress = Math.min(1, t / duration);
  const rotate = interpolate(progress, [0, 1], [-180, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const scale = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `rotate(${rotate}deg) scale(${scale})`, opacity };
}

export function zoomBlurIn(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.4 * fps);
  const progress = Math.min(1, t / duration);
  const scale = interpolate(progress, [0, 1], [3, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const blur = interpolate(progress, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity };
}

export function explodeIn(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.4 * fps);
  const progress = Math.min(1, t / duration);
  const scale = interpolate(progress, [0, 0.5, 1], [0, 1.2, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.bezier(0.68, -0.55, 0.265, 1.55),
  });
  const rotate = interpolate(progress, [0, 0.5, 1], [-10, 5, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const blur = interpolate(progress, [0, 0.5], [20, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const opacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  return { transform: `scale(${scale}) rotate(${rotate}deg)`, filter: `blur(${blur}px)`, opacity };
}

export function textReveal(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.6 * fps);
  const progress = Math.min(1, t / duration);
  const clip = interpolate(progress, [0, 1], [100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return { clipPath: `inset(0 ${clip}% 0 0)` };
}

export function pulseScale(frame: number, fps: number) {
  const t = frame % (0.8 * fps);
  const scale = interpolate(t, [0, 0.4 * fps], [1, 1.05], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });
  return scale;
}

export function jello(frame: number, fps: number, delay = 0) {
  const t = frame - delay;
  const duration = Math.round(0.9 * fps);
  if (t < 0 || t > duration) return { transform: 'skewX(0deg) skewY(0deg)' };
  const skew = interpolate(
    t,
    [0, 0.3 * duration, 0.4 * duration, 0.5 * duration, 0.65 * duration, 0.75 * duration, duration],
    [0, -12, 8, -5, 3, -2, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  return { transform: `skewX(${skew}deg) skewY(${skew}deg)` };
}
