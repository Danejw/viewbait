/**
 * Watermark Application Utilities
 *
 * Applies a QR code watermark to an image blob or canvas (bottom-right, configurable
 * size/padding, optional rounded rect). Supports "region invert" mode: sample the
 * QR region, average color, choose pure black or white for max contrast, and draw
 * only QR modules with center hollowed for the logo (no background).
 */

import { create as createQR } from "qrcode";
import { getQrAsImage, getLogoAsImage } from "@/lib/utils/qrCodeUtils";
import { QR_WATERMARK_URL } from "@/lib/constants/watermark";
import {
  DEFAULT_QR_SIZE,
  DEFAULT_QR_MARGIN,
  DEFAULT_QR_PADDING,
  DEFAULT_QR_BACKGROUND_RADIUS,
  DEFAULT_QR_OPACITY,
  DEFAULT_QR_DARK,
  DEFAULT_QR_LIGHT,
  USE_REGION_INVERT,
  QR_CENTER_LOGO_SIZE_RATIO,
} from "@/lib/constants/watermark";

export interface WatermarkOptions {
  /** QR size in pixels. */
  size?: number;
  /** Padding from image edge to QR. */
  padding?: number;
  /** Draw a rounded rect behind the QR (ignored when useRegionInvert is true). */
  roundedRect?: boolean;
  /** Corner radius for the background rect. */
  roundedRectRadius?: number;
  /** Global alpha for the watermark (0–1). */
  opacity?: number;
  /** When true, sample QR region, invert average color, draw only modules (no background). */
  useRegionInvert?: boolean;
  /** Palette of hex colors; dark/light are chosen by luminance. */
  paletteColors?: string[];
  /** If true and no palette, extract dominant colors from image. */
  autoExtractDominant?: boolean;
}

/** Minimum normalized luminance for "light" background so QR stays scannable. */
const MIN_LIGHT_LUMINANCE = 0.5;

/**
 * Relative luminance for a hex color (0 = black, 1 = white). Assumes sRGB.
 */
export function luminanceHex(hex: string): number {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6 && clean.length !== 8) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const l = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
}

/**
 * Lighten a hex color toward white by a factor (0 = no change, 1 = white).
 */
function lightenHex(hex: string, factor: number): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6 && clean.length !== 8) return hex;
  const r0 = parseInt(clean.slice(0, 2), 16);
  const g0 = parseInt(clean.slice(2, 4), 16);
  const b0 = parseInt(clean.slice(4, 6), 16);
  const r = Math.round(r0 + (255 - r0) * factor);
  const g = Math.round(g0 + (255 - g0) * factor);
  const b = Math.round(b0 + (255 - b0) * factor);
  return `#${[r, g, b].map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Choose dark and light colors from a palette by luminance. Ensures light is readable.
 */
function chooseDarkLightFromPalette(palette: string[]): { dark: string; light: string } {
  if (palette.length === 0) return { dark: DEFAULT_QR_DARK, light: DEFAULT_QR_LIGHT };
  const withLum = palette.map((hex) => ({ hex, lum: luminanceHex(hex) }));
  withLum.sort((a, b) => a.lum - b.lum);
  let dark = withLum[0]!.hex;
  let light = withLum[withLum.length - 1]!.hex;
  if (luminanceHex(light) < MIN_LIGHT_LUMINANCE) {
    light = lightenHex(light, 0.6);
  }
  return { dark, light };
}

/**
 * Sample canvas pixels and return a small set of dominant hex colors (simple bucketing).
 */
function extractDominantColors(canvas: HTMLCanvasElement, maxColors = 8): string[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const w = canvas.width;
  const h = canvas.height;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 32));
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();

  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const a = data[i + 3]!;
        if (a < 128) continue;
        const key = `${Math.floor(r / 32)}_${Math.floor(g / 32)}_${Math.floor(b / 32)}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.r += r;
          existing.g += g;
          existing.b += b;
          existing.n += 1;
        } else {
          buckets.set(key, { r, g, b, n: 1 });
        }
      }
    }
  } catch {
    return [];
  }

  const colors = Array.from(buckets.entries())
    .map(([, v]) => {
      const hex = `#${[v.r / v.n, v.g / v.n, v.b / v.n]
        .map((x) => Math.round(x))
        .map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0"))
        .join("")}`;
      return { hex, lum: luminanceHex(hex) };
    })
    .sort((a, b) => a.lum - b.lum);
  return colors.slice(0, maxColors).map((c) => c.hex);
}

function resolveDarkLight(
  canvas: HTMLCanvasElement,
  options: WatermarkOptions
): { dark: string; light: string } {
  if (options.paletteColors && options.paletteColors.length > 0) {
    return chooseDarkLightFromPalette(options.paletteColors);
  }
  // Default: derive dark/light from image dominant colors so QR matches thumbnail style.
  const palette = extractDominantColors(canvas);
  return chooseDarkLightFromPalette(palette.length > 0 ? palette : [DEFAULT_QR_DARK, DEFAULT_QR_LIGHT]);
}

/**
 * Load a blob as an HTMLImageElement (for drawing on canvas).
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image from blob"));
    };
    img.src = url;
  });
}

/**
 * Get average RGB in a canvas region (exclude transparent pixels).
 */
function getAverageColorInRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): { r: number; g: number; b: number } {
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 128) continue;
    sumR += data[i]!;
    sumG += data[i + 1]!;
    sumB += data[i + 2]!;
    count += 1;
  }
  if (count === 0) return { r: 128, g: 128, b: 128 };
  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Choose pure black or pure white for QR modules based on background luminance
 * (max contrast: white on dark background, black on light background).
 */
function chooseBlackOrWhiteForContrast(r: number, g: number, b: number): "#000000" | "#ffffff" {
  const hex = `#${[r, g, b].map((x) => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
  const lum = luminanceHex(hex);
  return lum < 0.5 ? "#ffffff" : "#000000";
}

/**
 * Draw only the dark QR modules in the given color (no background). Image shows through.
 * Hollows out the center so the logo can sit on the image without modules behind it.
 */
function drawQrModulesOnly(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  size: number,
  drawColorHex: string,
  margin: number,
  centerHollowRadiusPx: number
): void {
  const qr = createQR(url, { errorCorrectionLevel: "H" }) as {
    modules: { size: number; data: Uint8Array };
  };
  const modSize = qr.modules.size;
  const data = qr.modules.data;
  const scale = size / (modSize + 2 * margin);
  const centerJ = (modSize - 1) / 2;
  const centerI = centerJ;
  const hollowHalfModules = centerHollowRadiusPx / scale;

  ctx.fillStyle = drawColorHex;
  for (let i = 0; i < modSize; i++) {
    for (let j = 0; j < modSize; j++) {
      const inCenter =
        Math.abs((j - centerJ) + 0.5) <= hollowHalfModules &&
        Math.abs((i - centerI) + 0.5) <= hollowHalfModules;
      if (inCenter) continue;
      if (data[i * modSize + j]) {
        const px = x + (j + margin) * scale;
        const py = y + (i + margin) * scale;
        ctx.fillRect(px, py, scale + 1, scale + 1);
      }
    }
  }
}

/**
 * Draw the QR watermark onto an existing canvas (bottom-right). Used for HTML/PDF export.
 * Call this after the main content is drawn. Modifies the canvas in place.
 * When useRegionInvert is true (default), samples the QR region, chooses pure black or white
 * for contrast, draws only QR modules with center hollowed, then the logo. Otherwise uses full QR image + rounded rect.
 */
export async function applyQrWatermarkToCanvas(
  canvas: HTMLCanvasElement,
  options: WatermarkOptions = {}
): Promise<void> {
  const url = typeof QR_WATERMARK_URL === "string" && QR_WATERMARK_URL ? QR_WATERMARK_URL : undefined;
  if (!url) return;

  const size = options.size ?? DEFAULT_QR_SIZE;
  const padding = options.padding ?? DEFAULT_QR_PADDING;
  const opacity = options.opacity ?? DEFAULT_QR_OPACITY;
  const useRegionInvert = options.useRegionInvert ?? USE_REGION_INVERT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const x = canvas.width - size - padding;
  const y = canvas.height - size - padding;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (useRegionInvert) {
    const avg = getAverageColorInRegion(ctx, x, y, size, size);
    const drawColorHex = chooseBlackOrWhiteForContrast(avg.r, avg.g, avg.b);
    const logoSize = Math.max(8, Math.round(size * QR_CENTER_LOGO_SIZE_RATIO));
    const centerHollowRadiusPx = logoSize / 2;
    drawQrModulesOnly(ctx, url, x, y, size, drawColorHex, DEFAULT_QR_MARGIN, centerHollowRadiusPx);
    try {
      const logoImg = await getLogoAsImage(drawColorHex);
      const cx = x + size / 2;
      const cy = y + size / 2;
      ctx.drawImage(logoImg, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
    } catch {
      // Logo load failed; QR modules are still visible
    }
  } else {
    const roundedRect = options.roundedRect ?? true;
    const radius = options.roundedRectRadius ?? DEFAULT_QR_BACKGROUND_RADIUS;
    const { dark, light } = resolveDarkLight(canvas, options);
    const qrImage = await getQrAsImage(url, {
      size,
      margin: DEFAULT_QR_MARGIN,
      dark,
      light,
      centerLogo: true,
    });

    if (roundedRect) {
      const bgPadding = 4;
      const bx = x - bgPadding;
      const by = y - bgPadding;
      const bw = size + bgPadding * 2;
      const bh = size + bgPadding * 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, radius);
      ctx.fillStyle = light;
      ctx.fill();
    }

    ctx.drawImage(qrImage, x, y, size, size);
  }

  ctx.restore();
}

/**
 * Apply the QR watermark to an image blob and return a new blob (same type when possible).
 */
export async function applyQrWatermark(blob: Blob, options: WatermarkOptions = {}): Promise<Blob> {
  const url = typeof QR_WATERMARK_URL === "string" && QR_WATERMARK_URL ? QR_WATERMARK_URL : undefined;
  if (!url) return blob;

  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;

  ctx.drawImage(img, 0, 0);
  await applyQrWatermarkToCanvas(canvas, options);

  const mime = blob.type || "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
      mime.startsWith("image/") ? mime : "image/png",
      0.92
    );
  });
}
