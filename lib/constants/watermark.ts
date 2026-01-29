/**
 * Watermark / QR Code Constants
 *
 * Central config for the QR watermark shown on exported images for free-tier users.
 * QR URL and defaults are used by qrCodeUtils and watermarkUtils.
 */

/** URL encoded in the QR code (product/landing page). Prefer env; default sends users to viewbait.app. */
export const QR_WATERMARK_URL =
  process.env.NEXT_PUBLIC_QR_WATERMARK_URL ??
  "https://viewbait.app";

/** Default QR code size in pixels (drawn on canvas). */
export const DEFAULT_QR_SIZE = 96;

/** Default margin around QR modules (qrcode library margin option). */
export const DEFAULT_QR_MARGIN = 2;

/** Default padding from image edge to QR (bottom-right). */
export const DEFAULT_QR_PADDING = 12;

/** Default corner radius for optional rounded rect behind QR. */
export const DEFAULT_QR_BACKGROUND_RADIUS = 8;

/** Default global alpha for the watermark (0–1). */
export const DEFAULT_QR_OPACITY = 0.9;

/** Default dark color (QR foreground) when no palette/extract. */
export const DEFAULT_QR_DARK = "#111111";

/** Default light color (QR background) when no palette/extract. */
export const DEFAULT_QR_LIGHT = "#ffffff";

/** Logo size as ratio of QR size (center logo). ~0.22 keeps QR scannable with H correction. */
export const QR_CENTER_LOGO_SIZE_RATIO = 0.22;

/** Draw a light circle behind the center logo for contrast. */
export const QR_LOGO_LIGHT_CIRCLE = true;

/** When true, sample the QR region, choose pure black/white for contrast, and draw only modules with center hollow (no background). */
export const USE_REGION_INVERT = true;
