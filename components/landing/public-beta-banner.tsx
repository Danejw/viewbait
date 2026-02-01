"use client";

import React from "react";

const TEXT = "Now in Public Beta";
const REPEAT = 8;

/**
 * Animated banner at the top of the landing page. Red background, black text,
 * horizontal looping marquee. Rendered above the header.
 */
export function PublicBetaBanner() {
  return (
    <div className="public-beta-banner" role="marquee" aria-label={TEXT}>
      <div className="public-beta-banner-track">
        {Array.from({ length: REPEAT }, (_, i) => (
          <span key={i} className="public-beta-banner-item">
            {TEXT}
            <span className="public-beta-banner-sep" aria-hidden> • </span>
          </span>
        ))}
      </div>
    </div>
  );
}
