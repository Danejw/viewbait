"use client";

/**
 * CharacterSnapshotsStrip
 *
 * Horizontal strip of character snapshot cards from video frame extraction (FFmpeg.wasm).
 * Delegates to shared SnapshotsStrip with variant="character".
 */

import { memo, useMemo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { SnapshotsStrip, type SnapshotItem } from "@/components/studio/snapshots-strip";

export const CharacterSnapshotsStrip = memo(function CharacterSnapshotsStrip() {
  const { state } = useStudio();
  const byVideo = state.characterSnapshotsByVideoId || {};
  const byVideoNormalized = useMemo<Record<string, SnapshotItem[]>>(() => {
    const out: Record<string, SnapshotItem[]> = {};
    for (const [videoId, list] of Object.entries(byVideo)) {
      if (list?.length) {
        out[videoId] = list.map((s) => ({
          name: s.characterName,
          imageBlobUrl: s.imageBlobUrl,
          blob: s.blob,
        }));
      }
    }
    return out;
  }, [byVideo]);

  return (
    <SnapshotsStrip
      variant="character"
      title="Character snapshots"
      byVideo={byVideoNormalized}
      ariaLabel="Character snapshots from video"
      listAriaLabel="Character snapshot cards"
    />
  );
});
