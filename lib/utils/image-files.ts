/**
 * Pure helpers for validating and collecting image files from paste/drop/upload.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export interface FilterImageFilesOptions {
  maxBytes?: number;
  allowedTypes?: readonly string[];
}

/**
 * Filter files to allowed image types within size limit.
 */
export function filterValidImageFiles(
  files: Iterable<File>,
  options: FilterImageFilesOptions = {}
): File[] {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const allowed = options.allowedTypes ?? ALLOWED_IMAGE_TYPES;
  const out: File[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (!allowed.includes(file.type)) continue;
    if (file.size > maxBytes) continue;
    out.push(file);
  }
  return out;
}

/**
 * Limit files to remaining slots before max count.
 */
export function sliceFilesToRemainingSlots(
  files: File[],
  currentCount: number,
  maxCount: number
): File[] {
  const remaining = Math.max(0, maxCount - currentCount);
  return files.slice(0, remaining);
}

/**
 * Collect image files from clipboard paste event data.
 */
export function collectFilesFromClipboard(
  clipboardData: ClipboardEvent["clipboardData"] | null
): File[] {
  if (!clipboardData?.items) return [];
  const files: File[] = [];
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i];
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return filterValidImageFiles(files);
}

/**
 * Collect image files from drag-and-drop dataTransfer.
 */
export function collectFilesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer?.files?.length) return [];
  return filterValidImageFiles(Array.from(dataTransfer.files));
}
