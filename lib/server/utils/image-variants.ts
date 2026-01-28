/**
 * Image Variant Generation Utilities
 * 
 * Generates thumbnail variants (400w, 800w) from full-resolution images.
 * Uses sharp for server-side image processing.
 */

import sharp from 'sharp';

export interface VariantResult {
  path: string;
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Generate 400w variant from image buffer
 */
export async function generateThumbnail400w(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VariantResult | null> {
  try {
    const sharpInstance = sharp(imageBuffer);
    const metadata = await sharpInstance.metadata();
    
    if (!metadata.width || !metadata.height) {
      return null;
    }

    // Calculate dimensions maintaining aspect ratio
    const targetWidth = 400;
    const aspectRatio = metadata.width / metadata.height;
    const targetHeight = Math.round(targetWidth / aspectRatio);

    const resizedBuffer = await sharpInstance
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    return {
      path: `thumbnail-400w.jpg`,
      buffer: resizedBuffer,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (error) {
    console.error('Error generating 400w variant:', error);
    return null;
  }
}

/**
 * Generate 800w variant from image buffer
 */
export async function generateThumbnail800w(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VariantResult | null> {
  try {
    const sharpInstance = sharp(imageBuffer);
    const metadata = await sharpInstance.metadata();
    
    if (!metadata.width || !metadata.height) {
      return null;
    }

    // Calculate dimensions maintaining aspect ratio
    const targetWidth = 800;
    const aspectRatio = metadata.width / metadata.height;
    const targetHeight = Math.round(targetWidth / aspectRatio);

    const resizedBuffer = await sharpInstance
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    return {
      path: `thumbnail-800w.jpg`,
      buffer: resizedBuffer,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (error) {
    console.error('Error generating 800w variant:', error);
    return null;
  }
}

/**
 * Generate both 400w and 800w variants
 */
export async function generateThumbnailVariants(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{
  variant400w: VariantResult | null;
  variant800w: VariantResult | null;
}> {
  const [variant400w, variant800w] = await Promise.all([
    generateThumbnail400w(imageBuffer, mimeType),
    generateThumbnail800w(imageBuffer, mimeType),
  ]);

  return { variant400w, variant800w };
}
