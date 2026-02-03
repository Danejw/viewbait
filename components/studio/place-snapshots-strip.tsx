"use client";

/**
 * PlaceSnapshotsStrip
 *
 * Horizontal strip of place snapshot cards from video frame extraction (FFmpeg.wasm).
 * Delegates to shared SnapshotsStrip with variant="place".
 */

import { memo, useMemo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { SnapshotsStrip, type SnapshotItem } from "@/components/studio/snapshots-strip";

export const PlaceSnapshotsStrip = memo(function PlaceSnapshotsStrip() {
  const { state } = useStudio();
  const byVideo = state.placeSnapshotsByVideoId || {};
  const byVideoNormalized = useMemo<Record<string, SnapshotItem[]>>(() => {
    const out: Record<string, SnapshotItem[]> = {};
    for (const [videoId, list] of Object.entries(byVideo)) {
      if (list?.length) {
        out[videoId] = list.map((s) => ({
          name: s.placeName,
          imageBlobUrl: s.imageBlobUrl,
          blob: s.blob,
        }));
      }
    }
    return out;
  }, [byVideo]);

  return (
    <SnapshotsStrip
      variant="place"
      title="Place snapshots"
      byVideo={byVideoNormalized}
      ariaLabel="Place snapshots from video"
      listAriaLabel="Place snapshot cards"
    />
  );
});
