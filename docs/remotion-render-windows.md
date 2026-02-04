# Remotion render on Windows – "kill EPERM" workarounds

When rendering with `npx remotion render`, you may see:

```
Error: kill EPERM
    at ChildProcess.kill (node:internal/child_process:511:26)
    at spawnedKill (.../execa/lib/kill.js:9:21)
    at .../@remotion/renderer/dist/render-media.js:458:32
```

This happens on Windows when Node tries to kill the FFmpeg child process (during cleanup or on error). It is an environment/permission issue, not a bug in your composition.

## Workarounds

### 1. Use concurrency 1 (default on Windows in this project)

`remotion.config.ts` sets `Config.setConcurrency(1)` on Windows to reduce the number of child processes and the chance of EPERM. If you still see EPERM, try the options below.

### 2. Re-run the render

Sometimes the render completes on a second run. Use the same command:

```bash
npx remotion render remotion/index.ts ViewbaitPromo out/viewbait-promo.mp4 --overwrite
```

### 3. Render in two steps (sequence then encode)

Render an image sequence first, then encode with FFmpeg yourself so Remotion never has to kill the encoder:

**Step 1 – render frames to a folder:**

```bash
npx remotion render remotion/index.ts ViewbaitPromo out/frames --sequence --image-format=jpeg --overwrite
```

**Step 2 – encode with FFmpeg** (path and frame count depend on your composition; 30 fps, 1815 frames):

```bash
ffmpeg -framerate 30 -i "out/frames/%05d.jpeg" -i out/frames/audio.wav -c:v libx264 -crf 18 -c:a aac -shortest out/viewbait-promo.mp4
```

If the CLI does not output audio when using `--sequence`, you may need to use Remotion’s `renderFrames()` + `stitchFramesToVideo()` from a script, or run the normal render and retry if it hits EPERM.

### 4. Run from a different terminal

Use **Windows Terminal**, **cmd**, or **PowerShell as Administrator** and run the same render command. Sometimes process handles differ and the kill succeeds.

### 5. Shorter test render

To confirm the pipeline works, render a short range:

```bash
npx remotion render remotion/index.ts ViewbaitPromo out/viewbait-promo.mp4 --frames=0-300 --overwrite
```

If that completes, the composition and config are fine; the full-length EPERM is likely due to process cleanup on Windows.
