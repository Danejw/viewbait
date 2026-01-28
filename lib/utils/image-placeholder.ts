/**
 * Image Placeholder Utilities
 * 
 * Generates blur placeholders for images to improve loading experience.
 * Supports both client-side and server-side generation.
 */

/**
 * Generate a simple base64 blur placeholder
 * Creates a tiny 10x10 pixel image with a solid color
 */
export function generateBlurDataURL(
  width: number = 10,
  height: number = 10,
  color: string = "#e5e7eb"
): string {
  // Create a canvas to generate the placeholder
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    // Fallback: return a minimal SVG blur placeholder
    return generateSVGBlurPlaceholder(width, height, color);
  }
  
  // Fill with solid color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  // Convert to base64 data URL
  return canvas.toDataURL("image/png");
}

/**
 * Generate an SVG-based blur placeholder
 * More reliable and doesn't require canvas
 */
export function generateSVGBlurPlaceholder(
  width: number = 10,
  height: number = 10,
  color: string = "#e5e7eb"
): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `.trim();
  
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate a blur placeholder from an image URL
 * Fetches the image, creates a tiny version, and returns base64
 */
export async function generateBlurFromImage(
  imageUrl: string,
  width: number = 10,
  height: number = 10
): Promise<string> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return generateSVGBlurPlaceholder(width, height);
    }
    
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);
    
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      return generateSVGBlurPlaceholder(width, height);
    }
    
    // Draw scaled down image
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    
    // Convert to base64
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Failed to generate blur from image:", error);
    return generateSVGBlurPlaceholder(width, height);
  }
}

/**
 * Get a default blur placeholder based on aspect ratio
 * Returns a pre-generated blur that matches common aspect ratios
 */
export function getDefaultBlurPlaceholder(
  aspectRatio: "video" | "square" | "portrait" = "video"
): string {
  const placeholders: Record<string, string> = {
    video: generateSVGBlurPlaceholder(16, 9, "#e5e7eb"), // 16:9
    square: generateSVGBlurPlaceholder(1, 1, "#e5e7eb"), // 1:1
    portrait: generateSVGBlurPlaceholder(9, 16, "#e5e7eb"), // 9:16
  };
  
  return placeholders[aspectRatio] || placeholders.video;
}

/**
 * Server-side blur generation (Node.js compatible)
 * Note: This function should only be used in server-side code (API routes, server components)
 * For client-side usage, use generateSVGBlurPlaceholder or generateBlurFromImage
 */
export async function generateBlurServerSide(
  imageBuffer: Buffer,
  width: number = 10,
  height: number = 10
): Promise<string> {
  // For now, return SVG placeholder
  // In production, you can add sharp here if needed (only in server-side code)
  // Make sure to create a separate server-only utility file for sharp usage
  return generateSVGBlurPlaceholder(width, height);
}
