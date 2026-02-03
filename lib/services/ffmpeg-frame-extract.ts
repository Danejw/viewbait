/**
 * Client-side video frame extraction using FFmpeg.wasm.
 * Loads FFmpeg in the browser and extracts one frame at each given timestamp.
 * Use dynamic import from a client component to avoid SSR (e.g. from the analytics modal).
 */

export interface ExtractFramesResult {
  blobs: Blob[];
  error?: string;
}

let ffmpegInstance: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let loadPromise: Promise<boolean> | null = null;

/**
 * Load FFmpeg.wasm (single-thread, no SharedArrayBuffer required).
 * Safe to call multiple times; loads once.
 */
async function getFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadPromise) {
    await loadPromise;
    return ffmpegInstance!;
  }
  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegInstance = ffmpeg;
    return true;
  })();
  await loadPromise;
  return ffmpegInstance!;
}

/**
 * Extracts one PNG frame at each timestamp (in seconds).
 * Returns blobs in the same order as timestampsSeconds.
 * On failure throws or returns { blobs: [], error }.
 */
export async function extractFramesAt(
  videoFile: File,
  timestampsSeconds: number[]
): Promise<ExtractFramesResult> {
  if (timestampsSeconds.length === 0) {
    return { blobs: [] };
  }
  const { fetchFile } = await import("@ffmpeg/util");
  const ffmpeg = await getFFmpeg();
  const inputName = videoFile.name || "input.mp4";
  const inputData = await fetchFile(videoFile);
  await ffmpeg.writeFile(inputName, inputData);

  const blobs: Blob[] = [];
  try {
    for (let i = 0; i < timestampsSeconds.length; i++) {
      const t = timestampsSeconds[i];
      const outName = `frame_${i}.png`;
      const args = [
        "-ss",
        String(t),
        "-i",
        inputName,
        "-vframes",
        "1",
        "-f",
        "image2",
        outName,
      ];
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        return {
          blobs: [],
          error: "Frame extraction failed for this video format.",
        };
      }
      const data = await ffmpeg.readFile(outName);
      const uint8 = data instanceof Uint8Array ? data : new Uint8Array(0);
      blobs.push(new Blob([uint8], { type: "image/png" }));
      await ffmpeg.deleteFile(outName);
    }
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore cleanup errors
    }
  }
  return { blobs };
}
