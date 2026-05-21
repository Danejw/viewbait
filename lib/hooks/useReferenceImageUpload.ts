"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  collectFilesFromClipboard,
  collectFilesFromDataTransfer,
  filterValidImageFiles,
  sliceFilesToRemainingSlots,
} from "@/lib/utils/image-files";

export const MAX_REFERENCE_IMAGES = 4;

export interface ReferenceImageEntry {
  /** Signed URL after upload (used for API) */
  url: string;
  /** Local preview URL (blob or signed) */
  previewUrl: string;
}

export interface UseReferenceImageUploadOptions {
  maxCount?: number;
}

export interface UseReferenceImageUploadReturn {
  entries: ReferenceImageEntry[];
  urls: string[];
  isUploading: boolean;
  error: string | null;
  hasRoom: boolean;
  addFiles: (files: FileList | File[] | null) => Promise<void>;
  removeAt: (index: number) => void;
  reset: () => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
}

async function resolveUserId(userId: string | undefined): Promise<string | null> {
  if (userId) return userId;
  const res = await fetch("/api/profiles");
  if (!res.ok) return null;
  const data = await res.json();
  return data?.profile?.id ?? null;
}

async function uploadReferenceFile(
  file: File,
  userId: string,
  suffix: number
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/edit-ref-${Date.now()}-${suffix}.${ext}`;
  const formData = new FormData();
  formData.set("file", file);
  formData.set("bucket", "style-references");
  formData.set("path", path);
  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string })?.message || "Upload failed");
  }
  const data = await res.json();
  return (data?.url ?? data?.path ?? null) as string | null;
}

export function useReferenceImageUpload(
  options: UseReferenceImageUploadOptions = {}
): UseReferenceImageUploadReturn {
  const maxCount = options.maxCount ?? MAX_REFERENCE_IMAGES;
  const { user } = useAuth();
  const [entries, setEntries] = useState<ReferenceImageEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const revokePreviews = useCallback((list: ReferenceImageEntry[]) => {
    for (const entry of list) {
      if (entry.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setEntries((prev) => {
      revokePreviews(prev);
      return [];
    });
    setError(null);
    setIsUploading(false);
  }, [revokePreviews]);

  const removeAt = useCallback((index: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files?.length) return;

      const fileArray = Array.isArray(files) ? files : Array.from(files);
      const valid = filterValidImageFiles(fileArray);
      const toAdd = sliceFilesToRemainingSlots(
        valid,
        entriesRef.current.length,
        maxCount
      );
      if (toAdd.length === 0) return;

      setError(null);
      setIsUploading(true);

      const userId = await resolveUserId(user?.id);
      if (!userId) {
        setError("Sign in to add reference images");
        setIsUploading(false);
        return;
      }

      try {
        for (let i = 0; i < toAdd.length; i++) {
          const file = toAdd[i];
          const previewUrl = URL.createObjectURL(file);

          setEntries((prev) => {
            if (prev.length >= maxCount) {
              URL.revokeObjectURL(previewUrl);
              return prev;
            }
            return [...prev, { url: previewUrl, previewUrl }];
          });

          const url = await uploadReferenceFile(file, userId, i);

          if (!url) {
            setEntries((prev) => {
              const idx = prev.findIndex((e) => e.previewUrl === previewUrl);
              if (idx === -1) return prev;
              const next = [...prev];
              const removed = next.splice(idx, 1)[0];
              if (removed.previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(removed.previewUrl);
              }
              return next;
            });
            setError("Upload failed");
            continue;
          }

          setEntries((prev) => {
            const idx = prev.findIndex((e) => e.previewUrl === previewUrl);
            if (idx === -1) return prev;
            const next = [...prev];
            if (next[idx].previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(next[idx].previewUrl);
            }
            next[idx] = { url, previewUrl: url };
            return next;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [maxCount, user?.id]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const collected = collectFilesFromClipboard(e.clipboardData);
      if (collected.length === 0) return;
      e.preventDefault();
      void addFiles(collected);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const collected = collectFilesFromDataTransfer(e.dataTransfer);
      if (collected.length === 0) return;
      void addFiles(collected);
    },
    [addFiles]
  );

  const urls = entries
    .map((e) => e.url)
    .filter((u) => u.length > 0 && !u.startsWith("blob:"));
  const hasRoom = entries.length < maxCount;

  return {
    entries,
    urls,
    isUploading,
    error,
    hasRoom,
    addFiles,
    removeAt,
    reset,
    handlePaste,
    handleDrop,
  };
}
