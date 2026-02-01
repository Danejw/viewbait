/**
 * Generate PWA icons from the ViewBait logo SVG.
 * Outputs: public/icons/icon-192x192.png, icon-512x512.png, icon-512x512-maskable.png,
 *          and app/apple-icon.png (180x180 for iOS).
 *
 * Run: node scripts/generate-pwa-icons.js
 *
 * Requires: sharp (already in package.json).
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const APP_ICON_SVG = path.join(ROOT, "app", "icon.svg");

// ViewBait logo SVG (same paths as app/icon.svg); gradient #991b1b → #b91c3c
const LOGO_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#991b1b"/>
      <stop offset="100%" stop-color="#b91c3c"/>
    </linearGradient>
  </defs>
  <path d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15" stroke="url(#g)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5" stroke="url(#g)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Maskable: logo centered on CRT-dark background (#0a0a0a), ~80% size so safe zone is clear
const MASKABLE_BG = "#0a0a0a";
const MASKABLE_LOGO_SCALE = 0.8;

function maskableSvg(size) {
  const logoSize = Math.round(size * MASKABLE_LOGO_SCALE);
  const offset = (size - logoSize) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${MASKABLE_BG}"/>
  <g transform="translate(${offset},${offset}) scale(${logoSize / 24})">
    <defs>
      <linearGradient id="gm" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#991b1b"/>
        <stop offset="100%" stop-color="#b91c3c"/>
      </linearGradient>
    </defs>
    <path d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15" stroke="url(#gm)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5" stroke="url(#gm)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function main() {
  const iconsDir = path.join(ROOT, "public", "icons");
  const appDir = path.join(ROOT, "app");

  fs.mkdirSync(iconsDir, { recursive: true });

  const logoBuffer = Buffer.from(LOGO_SVG, "utf8");

  await Promise.all([
    sharp(logoBuffer).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192x192.png")),
    sharp(logoBuffer).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512x512.png")),
    sharp(Buffer.from(maskableSvg(512), "utf8")).png().toFile(path.join(iconsDir, "icon-512x512-maskable.png")),
    sharp(logoBuffer).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png")),
  ]);

  console.log("PWA icons generated:");
  console.log("  public/icons/icon-192x192.png");
  console.log("  public/icons/icon-512x512.png");
  console.log("  public/icons/icon-512x512-maskable.png");
  console.log("  app/apple-icon.png (180x180 for iOS)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
