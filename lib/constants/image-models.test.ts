import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODEL_GEMINI_API_IDS,
  IMAGE_MODEL_OPTIONS,
  OPENAI_IMAGE_MODEL_ID,
  isImageModelChoice,
  loadCachedImageModel,
  resolveImageModel,
  resolveImageModelApiId,
  saveCachedImageModel,
  STUDIO_IMAGE_MODEL_STORAGE_KEY,
} from "@/lib/constants/image-models";

describe("image-models", () => {
  describe("resolveImageModel", () => {
    it("maps nano-banana-pro to Gemini Pro image preview", () => {
      expect(resolveImageModel("nano-banana-pro")).toEqual({
        provider: "gemini",
        apiModelId: IMAGE_MODEL_GEMINI_API_IDS["nano-banana-pro"],
        choice: "nano-banana-pro",
      });
    });

    it("maps nano-banana-2 to Gemini flash image preview", () => {
      expect(resolveImageModel("nano-banana-2")).toEqual({
        provider: "gemini",
        apiModelId: IMAGE_MODEL_GEMINI_API_IDS["nano-banana-2"],
        choice: "nano-banana-2",
      });
    });

    it("maps gpt-image-2 to OpenAI", () => {
      expect(resolveImageModel("gpt-image-2")).toEqual({
        provider: "openai",
        apiModelId: OPENAI_IMAGE_MODEL_ID,
        choice: "gpt-image-2",
      });
    });

    it("defaults to Pro when choice is missing", () => {
      expect(resolveImageModel(undefined)).toEqual({
        provider: "gemini",
        apiModelId: IMAGE_MODEL_GEMINI_API_IDS["nano-banana-pro"],
        choice: "nano-banana-pro",
      });
    });

    it("defaults to Pro when choice is invalid", () => {
      expect(resolveImageModel("unknown-model")).toEqual({
        provider: "gemini",
        apiModelId: IMAGE_MODEL_GEMINI_API_IDS["nano-banana-pro"],
        choice: "nano-banana-pro",
      });
    });
  });

  describe("resolveImageModelApiId", () => {
    it("returns gpt-image-2 for OpenAI choice", () => {
      expect(resolveImageModelApiId("gpt-image-2")).toBe(OPENAI_IMAGE_MODEL_ID);
    });

    it("returns Gemini id for nano-banana-pro", () => {
      expect(resolveImageModelApiId("nano-banana-pro")).toBe(
        IMAGE_MODEL_GEMINI_API_IDS["nano-banana-pro"]
      );
    });
  });

  describe("isImageModelChoice", () => {
    it("accepts valid choices", () => {
      expect(isImageModelChoice("nano-banana-pro")).toBe(true);
      expect(isImageModelChoice("nano-banana-2")).toBe(true);
      expect(isImageModelChoice("gpt-image-2")).toBe(true);
    });

    it("rejects invalid values", () => {
      expect(isImageModelChoice("gemini-3-pro-image-preview")).toBe(false);
      expect(isImageModelChoice("")).toBe(false);
    });
  });

  describe("IMAGE_MODEL_OPTIONS", () => {
    it("exposes all user-facing labels", () => {
      const labels = IMAGE_MODEL_OPTIONS.map((o) => o.label);
      expect(labels).toContain("Nano Banana Pro");
      expect(labels).toContain("Nano Banana 2");
      expect(labels).toContain("GPT Image 2");
    });
  });

  describe("localStorage cache", () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
      storage.clear();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns default when nothing cached", () => {
      expect(loadCachedImageModel()).toBe(DEFAULT_IMAGE_MODEL);
    });

    it("persists and loads a valid choice", () => {
      saveCachedImageModel("nano-banana-2");
      expect(storage.get(STUDIO_IMAGE_MODEL_STORAGE_KEY)).toBe("nano-banana-2");
      expect(loadCachedImageModel()).toBe("nano-banana-2");
    });

    it("persists gpt-image-2", () => {
      saveCachedImageModel("gpt-image-2");
      expect(loadCachedImageModel()).toBe("gpt-image-2");
    });

    it("falls back to default for invalid cached value", () => {
      storage.set(STUDIO_IMAGE_MODEL_STORAGE_KEY, "bad-value");
      expect(loadCachedImageModel()).toBe(DEFAULT_IMAGE_MODEL);
    });
  });
});
