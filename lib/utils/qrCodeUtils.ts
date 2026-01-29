/**
 * QR Code Generation Utilities
 *
 * Encodes a fixed URL into a QR code image for watermarking. Uses the `qrcode` package
 * and caches results by (size, margin, dark, light) to avoid regenerating for many thumbnails.
 * Browser-safe only (no Node-only APIs).
 */

import QRCode from "qrcode";
import {
  DEFAULT_QR_SIZE,
  DEFAULT_QR_MARGIN,
  DEFAULT_QR_DARK,
  DEFAULT_QR_LIGHT,
  QR_CENTER_LOGO_SIZE_RATIO,
  QR_LOGO_LIGHT_CIRCLE,
} from "@/lib/constants/watermark";

/** App icon SVG (viewbait icon) – stroke placeholder replaced with dark color for center logo. */
const ICON_SVG_TEMPLATE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15" stroke="__DARK__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5" stroke="__DARK__" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export interface QrCodeOptions {
  /** Width/height of the QR image in pixels. */
  size?: number;
  /** Margin around QR modules (qrcode library option). */
  margin?: number;
  /** Dark color (foreground) hex. */
  dark?: string;
  /** Light color (background) hex. */
  light?: string;
  /** When true (default), draw app icon as center logo. */
  centerLogo?: boolean;
}

const cache = new Map<string, HTMLImageElement>();

/**
 * Build a cache key from options so the same QR is reused.
 */
function cacheKey(url: string, options: QrCodeOptions): string {
  const size = options.size ?? DEFAULT_QR_SIZE;
  const margin = options.margin ?? DEFAULT_QR_MARGIN;
  const dark = (options.dark ?? DEFAULT_QR_DARK).toLowerCase();
  const light = (options.light ?? DEFAULT_QR_LIGHT).toLowerCase();
  const centerLogo = options.centerLogo !== false;
  return `${url}|${size}|${margin}|${dark}|${light}|${centerLogo}`;
}

/**
 * Load the app icon as an image with stroke set to the given color (e.g. inverted region color).
 * Exported for use when drawing the center logo in the "region invert" watermark path.
 */
export function getLogoAsImage(colorHex: string): Promise<HTMLImageElement> {
  const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
  const svg = ICON_SVG_TEMPLATE.replace(/__DARK__/g, hex);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load logo image"));
    };
    img.src = objectUrl;
  });
}

/** Internal: same as getLogoAsImage, used when building QR+logo composite. */
function loadLogoAsImage(dark: string): Promise<HTMLImageElement> {
  return getLogoAsImage(dark);
}

/**
 * Generate QR with center logo: draw QR at H correction, then logo colored to match.
 */
async function getQrWithCenterLogo(
  url: string,
  size: number,
  margin: number,
  dark: string,
  light: string
): Promise<HTMLImageElement> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin,
    color: { dark, light },
    errorCorrectionLevel: "H",
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const logoSize = Math.round(size * QR_CENTER_LOGO_SIZE_RATIO);
  const cx = size / 2;
  const cy = size / 2;

  if (QR_LOGO_LIGHT_CIRCLE) {
    const circlePadding = 4;
    const radius = logoSize / 2 + circlePadding;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = light;
    ctx.fill();
  }

  const logoImg = await loadLogoAsImage(dark);
  const sx = cx - logoSize / 2;
  const sy = cy - logoSize / 2;
  ctx.drawImage(logoImg, sx, sy, logoSize, logoSize);

  return new Promise((resolve, reject) => {
    const dataUrl = canvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load QR+logo image"));
    img.src = dataUrl;
  });
}

/**
 * Generate a QR code as a data URL (PNG). Sync-friendly for callers that only need the URL.
 */
export function getQrDataUrl(
  url: string,
  options: QrCodeOptions = {}
): Promise<string> {
  const size = options.size ?? DEFAULT_QR_SIZE;
  const margin = options.margin ?? DEFAULT_QR_MARGIN;
  const dark = options.dark ?? DEFAULT_QR_DARK;
  const light = options.light ?? DEFAULT_QR_LIGHT;

  return QRCode.toDataURL(url, {
    width: size,
    margin,
    color: { dark, light },
    errorCorrectionLevel: "M",
  });
}

/**
 * Return the QR code as an HTMLImageElement for drawing on canvas. When centerLogo is true (default),
 * draws the app icon in the center colored to match the image-derived dark/light. Results are cached.
 */
export function getQrAsImage(
  url: string,
  options: QrCodeOptions = {}
): Promise<HTMLImageElement> {
  const key = cacheKey(url, options);
  const cached = cache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  const size = options.size ?? DEFAULT_QR_SIZE;
  const margin = options.margin ?? DEFAULT_QR_MARGIN;
  const dark = options.dark ?? DEFAULT_QR_DARK;
  const light = options.light ?? DEFAULT_QR_LIGHT;
  const centerLogo = options.centerLogo !== false;

  const promise = centerLogo
    ? getQrWithCenterLogo(url, size, margin, dark, light)
    : getQrDataUrl(url, options).then((dataUrl) => {
        const img = new Image();
        return new Promise<HTMLImageElement>((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load QR image"));
          img.src = dataUrl;
        });
      });

  return promise.then((img) => {
    cache.set(key, img);
    return img;
  });
}
