/**
 * Converts an image blob to JPEG format for download.
 * Used so the saved thumbnail file is always JPEG (.jpg).
 * If the blob is already image/jpeg, returns a clone to avoid re-encoding.
 */

const JPEG_MIME = "image/jpeg";

/**
 * Returns a JPEG blob. If the input is already JPEG, returns a clone.
 * Otherwise draws the image on a canvas and encodes as JPEG.
 *
 * @param blob - Image blob (any supported image type).
 * @param quality - JPEG quality 0–1 (default 0.92).
 * @returns Promise resolving to a Blob with type image/jpeg.
 */
export function blobToJpeg(blob: Blob, quality = 0.92): Promise<Blob> {
  const type = (blob.type || "").toLowerCase();
  if (type === JPEG_MIME || type === "image/jpg") {
    return Promise.resolve(blob.slice(0, blob.size, JPEG_MIME));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        JPEG_MIME,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image from blob"));
    };
    img.src = url;
  });
}
