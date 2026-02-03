/**
 * Parse scene.part strings from Gemini video analytics into seconds.
 * Used to pick representative timestamps for client-side frame extraction (FFmpeg.wasm).
 */

/**
 * Parses a single timestamp string to seconds.
 * Supports: "0:30", "1:15", "1:30:00" (hours:minutes:seconds).
 * Returns null if unparseable.
 */
export function parsePartToSeconds(part: string): number | null {
  const trimmed = String(part ?? "").trim();
  if (!trimmed) return null;

  // Match H:MM:SS or M:SS or MM:SS
  const hms = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    const s = parseInt(hms[3], 10);
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }

  const ms = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (ms) {
    const m = parseInt(ms[1], 10);
    const s = parseInt(ms[2], 10);
    if (s >= 60) return null;
    return m * 60 + s;
  }

  // Single number as seconds
  const onlyNum = trimmed.match(/^(\d+)$/);
  if (onlyNum) return parseInt(onlyNum[1], 10);

  return null;
}

/**
 * Parses a range string like "0:30–1:15" or "0:30-1:15" to [startSeconds, endSeconds].
 * Returns null if not a range or unparseable.
 */
export function parseRangeToSeconds(range: string): [number, number] | null {
  const trimmed = String(range ?? "").trim();
  const separator = /[–\-]\s*/;
  const parts = trimmed.split(separator).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const start = parsePartToSeconds(parts[0]);
  const end = parsePartToSeconds(parts[1]);
  if (start == null || end == null || start > end) return null;
  return [start, end];
}

export interface CharacterWithScenes {
  name: string;
  scenes: Array<{ part: string; description?: string }>;
}

/**
 * Returns one representative timestamp in seconds for a character.
 * Uses the first parseable scene: if it's a range, returns the midpoint; otherwise the single time.
 * Returns null if no scene has a parseable timestamp.
 */
export function getRepresentativeSecondsForCharacter(
  character: CharacterWithScenes
): number | null {
  if (!character?.scenes?.length) return null;
  for (const scene of character.scenes) {
    const range = parseRangeToSeconds(scene.part);
    if (range) {
      const [start, end] = range;
      return Math.floor((start + end) / 2);
    }
    const single = parsePartToSeconds(scene.part);
    if (single != null) return single;
  }
  return 0;
}
