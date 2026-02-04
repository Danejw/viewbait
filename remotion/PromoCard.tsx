/**
 * Renders a single promo card. All motion is driven by useCurrentFrame() (Remotion best practice).
 * Uses the more animated version: slam, scale-pop, rings, particles, glitch-reveal, etc.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { Card } from './cardData';
import {
  slamIn,
  slideBottom,
  scalePop,
  zoomPulse,
  blurIn,
  glitchReveal,
  bouncePop,
  heartbeat,
  wobble,
  drawLine,
  slideLeft,
  slideRight,
  slideUpBounce,
  rotateIn,
  zoomBlurIn,
  explodeIn,
  textReveal,
  pulseScale,
  jello,
} from './animations';

const LOGO_ICON = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
    <path
      d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type PromoCardProps = { card: Card };

export const PromoCard: React.FC<PromoCardProps> = ({ card }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  });
  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(entrance, [0, 1], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isWhite = card.bg === 'white';
  const bgColor = isWhite ? '#fafafa' : '#030303';

  const content = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {card.type === 'big-text' && (() => {
        const slam = slamIn(frame, fps, 0);
        const sub = slideBottom(frame, fps, 9);
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <h1
              style={{
                fontSize: 'clamp(60px, 15vw, 180px)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                color: card.highlight ? undefined : '#fff',
                background: card.highlight
                  ? 'linear-gradient(135deg, #ff0000 0%, #ff4444 50%, #ff0000 100%)'
                  : undefined,
                backgroundSize: card.highlight ? '200% auto' : undefined,
                WebkitBackgroundClip: card.highlight ? 'text' : undefined,
                WebkitTextFillColor: card.highlight ? 'transparent' : undefined,
                backgroundClip: card.highlight ? 'text' : undefined,
                ...slam,
              }}
            >
              {card.text}
            </h1>
            {card.subtext && (
              <p
                style={{
                  fontSize: 'clamp(24px, 5vw, 60px)',
                  fontWeight: 700,
                  marginTop: 20,
                  color: card.highlight ? undefined : '#666',
                  letterSpacing: '-0.02em',
                  ...sub,
                }}
              >
                {card.subtext}
              </p>
            )}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-10%',
                width: '20%',
                height: 4,
                background: 'linear-gradient(90deg, transparent, #ff0000)',
                opacity: drawLine(frame, fps, 12) * 0.8,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                right: '-10%',
                width: '20%',
                height: 4,
                background: 'linear-gradient(-90deg, transparent, #ff0000)',
                opacity: drawLine(frame, fps, 12) * 0.8,
              }}
            />
          </div>
        );
      })()}

      {card.type === 'stat' && (() => {
        const isPositive = card.sentiment === 'positive';
        const ringColor = isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(255,0,0,0.2)';
        const ringColor2 = isPositive ? 'rgba(34,197,94,0.1)' : 'rgba(255,0,0,0.1)';
        const numColor = isPositive ? '#22c55e' : '#ff0000';
        const pop = scalePop(frame, fps, 0);
        const labelStyle = slideBottom(frame, fps, 6);
        const subStyle = blurIn(frame, fps, 12);
        const pulse1 = zoomPulse(frame, fps, 0);
        const pulse2 = zoomPulse(frame, fps, 9);
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${pulse1})`,
                width: 300,
                height: 300,
                border: `2px solid ${ringColor}`,
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${pulse2})`,
                width: 400,
                height: 400,
                border: `1px solid ${ringColor2}`,
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                fontSize: 'clamp(80px, 20vw, 220px)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 0.9,
                color: numColor,
                position: 'relative',
                zIndex: 1,
                ...pop,
              }}
            >
              {card.number}
            </div>
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 'clamp(16px, 3vw, 32px)',
                fontWeight: 700,
                marginTop: 24,
                color: '#fff',
                letterSpacing: '0.1em',
                position: 'relative',
                zIndex: 1,
                ...labelStyle,
              }}
            >
              {card.label}
            </p>
            {card.subtext && (
              <p
                style={{
                  fontSize: 'clamp(14px, 2vw, 24px)',
                  marginTop: 12,
                  color: '#555',
                  position: 'relative',
                  zIndex: 1,
                  ...subStyle,
                }}
              >
                {card.subtext}
              </p>
            )}
          </div>
        );
      })()}

      {card.type === 'text-stack' && (
        <div style={{ textAlign: 'center' }}>
          {card.label && (
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 16,
                color: '#ff4444',
                letterSpacing: '0.15em',
                marginBottom: 32,
                ...blurIn(frame, fps, 0),
              }}
            >
              {card.label}
            </p>
          )}
          {card.lines.map((line, i) => {
            const lineStyle = slideLeft(frame, fps, i * 5);
            const dotScale = heartbeat(frame, fps, i * 6);
            return (
              <div
                key={i}
                style={{
                  fontSize: 'clamp(32px, 7vw, 80px)',
                  fontWeight: 800,
                  color: i % 2 === 0 ? '#fff' : '#444',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  ...lineStyle,
                }}
              >
                {line}
                {i % 2 === 0 && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      background: '#ff0000',
                      borderRadius: '50%',
                      transform: `scale(${dotScale})`,
                      boxShadow: '0 0 20px rgba(255,0,0,0.5)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {card.type === 'centered' && (() => {
        const burstScale = zoomPulse(frame, fps, 0);
        const textStyle = { ...zoomBlurIn(frame, fps, 0), ...jello(frame, fps, 0) };
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${burstScale})`,
                width: 600,
                height: 600,
                background: 'radial-gradient(circle, rgba(255,0,0,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <p
              style={{
                fontSize: 'clamp(36px, 8vw, 100px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: card.highlight ? undefined : '#fff',
                background: card.highlight
                  ? 'linear-gradient(135deg, #ff0000 0%, #ff4444 50%, #ff0000 100%)'
                  : undefined,
                backgroundSize: card.highlight ? '200% auto' : undefined,
                WebkitBackgroundClip: card.highlight ? 'text' : undefined,
                WebkitTextFillColor: card.highlight ? 'transparent' : undefined,
                backgroundClip: card.highlight ? 'text' : undefined,
                position: 'relative',
                zIndex: 1,
                ...textStyle,
              }}
            >
              {card.text}
            </p>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const s = heartbeat(frame, fps, i * 6);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    background: '#ff0000',
                    borderRadius: '50%',
                    top: `${20 + (i * 10)}%`,
                    left: `${10 + (i * 14)}%`,
                    transform: `scale(${s})`,
                    boxShadow: '0 0 20px rgba(255,0,0,0.8)',
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
          </div>
        );
      })()}

      {card.type === 'logo-reveal' && (() => {
        const ring1 = zoomPulse(frame, fps, 0);
        const ring2 = zoomPulse(frame, fps, 6);
        const iconStyle = rotateIn(frame, fps, 0);
        const textStyle = glitchReveal(frame, fps, 6);
        const hb = heartbeat(frame, fps, 18);
        return (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${ring1})`,
                width: 400,
                height: 400,
                border: '2px solid rgba(255,0,0,0.3)',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${ring2})`,
                width: 500,
                height: 500,
                border: '1px solid rgba(255,0,0,0.15)',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: '#ff0000',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 60px rgba(255,0,0,0.5)',
                  transform: `${iconStyle.transform} scale(${hb})`,
                  opacity: iconStyle.opacity,
                }}
              >
                {LOGO_ICON}
              </div>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: '#fff',
                  ...textStyle,
                }}
              >
                VIEWBAIT
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at center, rgba(255,0,0,0.3) 0%, transparent 60%)',
                opacity: interpolate(frame, [0, 30], [0.6, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }),
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })()}

      {card.type === 'tagline' && (() => {
        const lineProgress = drawLine(frame, fps, 0, 24);
        const labelReveal = textReveal(frame, fps, 0);
        const subSlam = slamIn(frame, fps, 0);
        const subWobble = wobble(frame, fps, 15);
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                bottom: '40%',
                left: '10%',
                right: '10%',
                height: 4,
                background: 'linear-gradient(90deg, transparent, #ff0000, transparent)',
                opacity: 0.5 * lineProgress,
              }}
            />
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 'clamp(14px, 2vw, 20px)',
                color: '#ff4444',
                letterSpacing: '0.2em',
                marginBottom: 16,
                ...labelReveal,
              }}
            >
              {card.text}
            </p>
            <h2
              style={{
                fontSize: 'clamp(40px, 10vw, 120px)',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.04em',
                opacity: subSlam.opacity,
                transform: `${subSlam.transform} ${subWobble.transform}`,
              }}
            >
              {card.subtext}
            </h2>
          </div>
        );
      })()}

      {card.type === 'feature' && (() => {
        const glowPulse = zoomPulse(frame, fps, 0);
        const iconStyle = bouncePop(frame, fps, 0);
        const iconHb = heartbeat(frame, fps, 15);
        const titleReveal = glitchReveal(frame, fps, 6);
        const descStyle = blurIn(frame, fps, 12);
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '20%',
                left: '50%',
                transform: `translateX(-50%) scale(${glowPulse})`,
                width: 200,
                height: 200,
                background: 'radial-gradient(circle, rgba(255,0,0,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                fontSize: 100,
                marginBottom: 32,
                position: 'relative',
                zIndex: 1,
                filter: 'drop-shadow(0 0 40px rgba(255,255,255,0.3))',
                ...iconStyle,
                transform: `${iconStyle.transform} scale(${iconHb})`,
              }}
            >
              {card.icon}
            </div>
            <h2
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 'clamp(24px, 5vw, 48px)',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.05em',
                marginBottom: 16,
                position: 'relative',
                zIndex: 1,
                ...titleReveal,
              }}
            >
              {card.title}
            </h2>
            <p
              style={{
                fontSize: 'clamp(18px, 3vw, 32px)',
                color: '#888',
                position: 'relative',
                zIndex: 1,
                ...descStyle,
              }}
            >
              {card.description}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                marginTop: 32,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    background: '#ff0000',
                    borderRadius: '50%',
                    transform: `scale(${heartbeat(frame, fps, i * 3)})`,
                    boxShadow: '0 0 15px rgba(255,0,0,0.6)',
                  }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {card.type === 'demo-chat' && (
        <div
          style={{
            width: '100%',
            maxWidth: 700,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {card.messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: '20px 28px',
                  borderRadius: 16,
                  background: msg.role === 'user' ? 'rgba(255,0,0,0.15)' : 'rgba(255,255,255,0.05)',
                  border:
                    msg.role === 'user'
                      ? '1px solid rgba(255,0,0,0.3)'
                      : '1px solid rgba(255,255,255,0.1)',
                  maxWidth: '80%',
                }}
              >
                <p
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 'clamp(16px, 2.5vw, 24px)',
                    color: msg.role === 'user' ? '#fff' : '#888',
                  }}
                >
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {card.type === 'testimonial' && (() => {
        const quoteReveal = textReveal(frame, fps, 0);
        const authorStyle = slideUpBounce(frame, fps, 12);
        const lineProgress = drawLine(frame, fps, 12, 18);
        const starStyle = (i: number) => bouncePop(frame, fps, 18 + i * 3);
        return (
          <div style={{ textAlign: 'center', maxWidth: 900, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: -60,
                left: -20,
                fontSize: 200,
                fontWeight: 900,
                color: 'rgba(255,0,0,0.1)',
                lineHeight: 1,
                ...blurIn(frame, fps, 0),
                pointerEvents: 'none',
              }}
            >
              "
            </div>
            <p
              style={{
                fontSize: 'clamp(28px, 6vw, 64px)',
                fontWeight: 600,
                color: '#fff',
                fontStyle: 'italic',
                lineHeight: 1.3,
                marginBottom: 32,
                position: 'relative',
                zIndex: 1,
                ...quoteReveal,
              }}
            >
              {card.quote}
            </p>
            <div style={{ ...authorStyle, position: 'relative', zIndex: 1 }}>
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 'clamp(16px, 2vw, 24px)',
                  color: '#ff4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 2,
                    background: '#ff0000',
                    transform: `scaleX(${lineProgress})`,
                    transformOrigin: 'left',
                  }}
                />
                {card.author}
                <span
                  style={{
                    width: 40,
                    height: 2,
                    background: '#ff0000',
                    transform: `scaleX(${lineProgress})`,
                    transformOrigin: 'left',
                  }}
                />
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                marginTop: 24,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={{
                    color: '#ffaa00',
                    fontSize: 24,
                    filter: 'drop-shadow(0 0 10px rgba(255,170,0,0.5))',
                    ...starStyle(i),
                  }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {card.type === 'pricing' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 'clamp(80px, 18vw, 200px)',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
              background: 'linear-gradient(135deg, #ff0000 0%, #ff4444 50%, #ff0000 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {card.plan}
          </div>
          <div style={{ marginTop: 32 }}>
            {card.features.map((feature, i) => (
              <p
                key={i}
                style={{
                  fontSize: 'clamp(18px, 3vw, 32px)',
                  color: '#888',
                  marginTop: i > 0 ? 12 : 0,
                }}
              >
                {feature}
              </p>
            ))}
          </div>
        </div>
      )}

      {card.type === 'cta' && (() => {
        const slam = slamIn(frame, fps, 0);
        const ps = pulseScale(frame);
        const subStyle = blurIn(frame, fps, 9);
        const arrowStyle = bouncePop(frame, fps, 18);
        const arrowHb = heartbeat(frame, fps, 24);
        return (
          <div style={{ textAlign: 'center', position: 'relative' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) scale(${zoomPulse(frame, fps, i * 6)})`,
                  width: 300 + i * 150,
                  height: 300 + i * 150,
                  border: `${3 - i}px solid rgba(255,0,0,${0.3 - i * 0.1})`,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            ))}
            <div
              style={{
                fontSize: 'clamp(48px, 12vw, 140px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#fff',
                marginBottom: 24,
                position: 'relative',
                zIndex: 1,
                ...slam,
                transform: `${slam.transform} scale(${ps})`,
              }}
            >
              {card.text}
            </div>
            <p
              style={{
                fontSize: 'clamp(20px, 4vw, 40px)',
                color: '#888',
                position: 'relative',
                zIndex: 1,
                ...subStyle,
              }}
            >
              {card.subtext}
            </p>
            <div
              style={{
                marginTop: 40,
                position: 'relative',
                zIndex: 1,
                ...arrowStyle,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  margin: '0 auto',
                  border: '3px solid #ff0000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${arrowHb})`,
                  boxShadow: '0 0 30px rgba(255,0,0,0.4)',
                }}
              >
                <span style={{ fontSize: 24, color: '#ff0000' }}>→</span>
              </div>
            </div>
          </div>
        );
      })()}

      {card.type === 'logo-final-animated' && (
        <LogoFinalAnimated words={card.words} frame={frame} fps={fps} />
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bgColor,
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {!isWhite && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)`,
              pointerEvents: 'none',
            }}
          />
          <FloatingParticles frame={frame} fps={fps} />
        </>
      )}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          width: 30,
          height: 30,
          borderColor: isWhite ? 'rgba(255,0,0,0.3)' : 'rgba(255, 0, 0, 0.5)',
          borderStyle: 'solid',
          borderWidth: '2px 0 0 2px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          width: 30,
          height: 30,
          borderColor: isWhite ? 'rgba(255,0,0,0.3)' : 'rgba(255, 0, 0, 0.5)',
          borderStyle: 'solid',
          borderWidth: '2px 2px 0 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          width: 30,
          height: 30,
          borderColor: isWhite ? 'rgba(255,0,0,0.3)' : 'rgba(255, 0, 0, 0.5)',
          borderStyle: 'solid',
          borderWidth: '0 0 2px 2px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: 30,
          height: 30,
          borderColor: isWhite ? 'rgba(255,0,0,0.3)' : 'rgba(255, 0, 0, 0.5)',
          borderStyle: 'solid',
          borderWidth: '0 2px 2px 0',
        }}
      />
      {card.bg === 'red-glow' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.15) 0%, #030303 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {card.bg === 'green-glow' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(34,197,94,0.15) 0%, #030303 70%)',
            pointerEvents: 'none',
          }}
        />
      )}
      {content}
    </div>
  );
};

/** Floating red particles for dark cards. */
const FloatingParticles: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const duration = 4 * fps;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const t = (frame + i * 15) % duration;
        const y = interpolate(t, [0, duration], [100, -10], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });
        const opacity = interpolate(t, [0, 0.1 * duration, 0.9 * duration, duration], [0, 1, 1, 0], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });
        const size = 3 + (i % 3) * 1.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${5 + (i * 7.5) % 90}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: '#ff0000',
              borderRadius: '50%',
              boxShadow: '0 0 10px rgba(255,0,0,0.8)',
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

/** Word-cycling tagline for the final card. Driven by frame. */
const LogoFinalAnimated: React.FC<{
  words: string[];
  frame: number;
  fps: number;
}> = ({ words, frame, fps }) => {
  const cycleFrames = 1 * fps;
  const index = Math.floor((frame % (words.length * cycleFrames)) / cycleFrames) % words.length;
  const progress = (frame % cycleFrames) / cycleFrames;
  const inOut = interpolate(progress, [0, 0.3, 0.7, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        textAlign: 'center',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        position: 'absolute',
        inset: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          marginBottom: 60,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            background: '#ff0000',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(255,0,0,0.3)',
          }}
        >
          {LOGO_ICON}
        </div>
        <span
          style={{
            fontSize: 'clamp(36px, 8vw, 64px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: '#0a0a0a',
          }}
        >
          VIEWBAIT
        </span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span
          style={{
            fontSize: 'clamp(48px, 12vw, 140px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            color: '#0a0a0a',
            display: 'block',
          }}
        >
          DESIGN FOR
        </span>
        <div
          style={{
            fontSize: 'clamp(48px, 12vw, 140px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1.1,
            minHeight: '1.2em',
            opacity: inOut,
          }}
        >
          {words[index]}
        </div>
      </div>
    </div>
  );
};
