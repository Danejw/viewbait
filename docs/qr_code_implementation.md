# QR Code Implementation in ViewBait

This document describes how QR codes are implemented in this application: what they do, what they require, and how they are wired through the codebase. It is intended for reuse in another application.

---

## What We Are Doing

In this app, QR codes are used as **watermarks** on exported infographic images for **free (non‑paid) users**. The QR code:

- Encodes a fixed URL (product/landing page, from `NEXT_PUBLIC_QR_WATERMARK_URL` or `NEXT_PUBLIC_APP_URL` or same origin).
- Is drawn in the **bottom‑right corner** of the image with configurable size, padding, and opacity.
- Can be **styled** with custom dark/light colors so it fits the image (or a chosen palette).
- Optionally sits on a **rounded rectangle background** to stay readable on dark or busy areas.
- Is applied at **download time** (single image, ZIP, or HTML/PDF export) and also for **preview** so that what users see matches what they download.

So the implementation is: **generate a QR code image → optionally pick colors from the image or a palette → draw it onto the image (or canvas) at a fixed position → output the result as blob or canvas.**

---

## What It Takes

### Dependency

- **Library:** `qrcode` (npm package).
- **Versions in this project:** `qrcode@^1.5.4`, `@types/qrcode@^1.5.6` (TypeScript types).

The library is used to turn a string (the URL) into a QR code image. We use it to produce a **data URL** (PNG), then draw that onto a canvas or use it as an image source.

### Supporting Pieces (No Extra QR Dependencies)

- **Canvas API** – to draw the original image and the QR on top (size, position, opacity, optional background shape).
- **Color extraction** – to get dominant colors from the image (or use a provided palette) so the QR can be dark-on-light with good contrast and scannability.
- **Blob/URL handling** – to load images from blobs, create object URLs for preview, and produce output blobs (e.g. for download or ZIP).

So: one QR dependency (`qrcode`), plus browser Canvas and standard blob/URL usage.

---

## How It Is Implemented

Implementation is split into three layers: **QR generation**, **watermark application**, and **call sites**.

### 1. QR generation (`lib/utils/qrCodeUtils.ts`)

- **Constants:** QR URL and default size/margin/colors live in `lib/constants/watermark.ts`.
- **Single encoded value:** One URL (from constants) is encoded into the QR.
- **Output formats:**
  - **Data URL (PNG):** `QRCode.toDataURL(url, options)` with `width`, `margin`, `color.dark` / `color.light`, and `errorCorrectionLevel: 'M'`.
  - **Image element:** Data URL is set on an `Image()`; we wait for `onload` and return that `HTMLImageElement` for drawing on a canvas.
- **Options:** Size (pixels), margin (modules), dark color (hex), light color (hex).
- **Caching:** A cache key is built from size + margin + dark + light; we store resulting `HTMLImageElement`s in a `Map` and reuse them so we don’t regenerate the same QR repeatedly (e.g. when watermarking many images with the same style).

So this layer: **url + options → data URL or image; same options → cached image.**

### 2. Watermark application (`lib/utils/watermarkUtils.ts`)

- **Color selection:**  
  - If the caller provides **palette colors** (e.g. from the project), we pick one “dark” and one “light” from that palette (by luminance) so the QR stays scannable (dark foreground, light background).  
  - If not, and if **auto-extract** is enabled, we extract dominant colors from the image blob (e.g. k‑means on sampled pixels) and again pick dark/light from that set.  
  - If the chosen “light” is too dark (e.g. normalized luminance &lt; 0.5), we lighten it so the QR background stays readable.
- **Drawing the watermark:**  
  - Load the source image from the blob onto a canvas (or use an existing canvas).  
  - Get the QR as an image (from `qrCodeUtils`: cached by size + colors).  
  - Position at **bottom‑right**: `x = width - qrSize - padding`, `y = height - qrSize - padding`.  
  - Optional: draw a rounded rectangle behind the QR (background color = light color, extra padding), then draw the QR image on top.  
  - Apply a global opacity (e.g. 0.9) for the watermark so it doesn’t overpower the image.
- **Output:**  
  - **Blob path:** Create canvas → draw original image → draw QR watermark → `canvas.toBlob()` (JPEG or PNG from original blob type).  
  - **Canvas path:** Same drawing steps on an existing canvas (used for HTML/PDF export that already rendered to canvas).

So this layer: **image blob (or canvas) + options (size, padding, opacity, colors/palette, auto-extract) → same image with QR in the corner.**

### 3. Where the watermark is used (ViewBait)

- **Single image download (free user):** In `components/studio/studio-provider.tsx`, `onDownloadThumbnail` fetches the image URL → blob → `applyQrWatermark(blob)` → creates an object URL → triggers download → revokes the URL. Paid users download the original URL directly.
- **Preview (free user):** The hook `lib/hooks/useWatermarkedImage.ts` fetches the image URL → blob → `applyQrWatermark(blob, options)` → creates an object URL and caches it by URL (and options). Used in:
  - **Thumbnail cards:** `components/studio/thumbnail-card.tsx` passes the watermarked URL to `ProgressiveImage` when `useSubscription().hasWatermark()` is true.
  - **Image view modal:** `studio-provider.tsx` uses the same hook for `state.thumbnailToView` and passes the result to `ImageModal`.
  - **Delete confirmation modal:** `components/studio/delete-confirmation-modal.tsx` shows the watermarked preview when the user has a watermark.
  - **Thumbnail edit modal:** `components/studio/thumbnail-edit-modal.tsx` shows the watermarked preview when the user has a watermark.
- **ZIP / multi-image download:** When the client builds a ZIP from the experiment download-pack response (or similar), each image blob should be passed through `applyQrWatermark(blob)` for free users before adding to the ZIP. The download-pack API currently returns JSON with base64 image data; the client that assembles the ZIP should apply the watermark per image when the user tier has a watermark.
- **HTML/PDF export (future):** When canvas-based HTML/PDF export is added, call `applyQrWatermarkToCanvas(canvas, options)` for free users before exporting the canvas to PNG/PDF.

In all cases, “free user” is determined by `useSubscription().hasWatermark()` (from tier config `has_watermark`).

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Purpose** | QR watermark on exported images for free users; links to a fixed URL. |
| **Placement** | Bottom‑right, with configurable size and padding; optional rounded background. |
| **Styling** | Dark/light colors from palette, or auto-extracted from image; luminance checks for scannability. |
| **QR dependency** | `qrcode` (npm). |
| **Layers** | 1) Generate/cache QR as image from URL. 2) Choose colors; draw QR onto image/canvas. 3) Call from download, ZIP, HTML/PDF export, and preview. |

---

## Prompt for Another Application (dependency only)

Use the following as a high-level prompt to implement the same idea elsewhere, adding only the dependency name where needed.

---

**Prompt:**

We want to add a QR code watermark to exported images for a certain user tier (e.g. free users). The QR code should encode a single fixed URL (our product or landing page). It should appear in the bottom-right corner of the image with a configurable size and padding, and optionally a rounded rectangle behind it so it stays readable on dark or busy images. We may want to style the QR (dark and light colors) from a palette or by extracting dominant colors from the image, while keeping enough contrast so the code remains scannable. The watermark should be applied when the user downloads a single image, when they download multiple images (e.g. in a ZIP), and when they export to HTML/PDF if the export is rendered to a canvas. For consistency, the same watermarked image should be shown in the preview so that what the user sees matches what they get when they download. Use the **`qrcode`** npm package (and its TypeScript types if the project is in TypeScript) to generate the QR code; the rest can be implemented with the browser Canvas API and standard blob/URL handling.

**Dependency to add:** `qrcode` (and optionally `@types/qrcode` for TypeScript).

---

*End of document.*
