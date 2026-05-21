/**
 * Unit tests for image file helpers used in reference image uploads.
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  DEFAULT_MAX_IMAGE_BYTES,
  filterValidImageFiles,
  collectFilesFromClipboard,
  collectFilesFromDataTransfer,
  sliceFilesToRemainingSlots,
} from "@/lib/utils/image-files";

function makeFile(name: string, type: string, size = 100): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("filterValidImageFiles", () => {
  it("keeps allowed image types within size limit", () => {
    const files = [
      makeFile("a.png", "image/png"),
      makeFile("b.jpg", "image/jpeg"),
      makeFile("c.webp", "image/webp"),
      makeFile("d.gif", "image/gif"),
    ];
    const result = filterValidImageFiles(files);
    expect(result).toHaveLength(4);
  });

  it("rejects non-image MIME types", () => {
    const files = [makeFile("doc.pdf", "application/pdf"), makeFile("a.png", "image/png")];
    const result = filterValidImageFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("a.png");
  });

  it("rejects files over max size", () => {
    const big = makeFile("big.png", "image/png", DEFAULT_MAX_IMAGE_BYTES + 1);
    const ok = makeFile("ok.png", "image/png");
    const result = filterValidImageFiles([big, ok]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("ok.png");
  });

  it("uses custom maxBytes when provided", () => {
    const file = makeFile("mid.png", "image/png", 500);
    expect(filterValidImageFiles([file], { maxBytes: 400 })).toHaveLength(0);
    expect(filterValidImageFiles([file], { maxBytes: 600 })).toHaveLength(1);
  });
});

describe("sliceFilesToRemainingSlots", () => {
  it("returns at most remaining slots", () => {
    const files = [
      makeFile("1.png", "image/png"),
      makeFile("2.png", "image/png"),
      makeFile("3.png", "image/png"),
    ];
    expect(sliceFilesToRemainingSlots(files, 2, 4)).toHaveLength(2);
    expect(sliceFilesToRemainingSlots(files, 3, 4)).toHaveLength(1);
    expect(sliceFilesToRemainingSlots(files, 4, 4)).toHaveLength(0);
  });
});

describe("collectFilesFromClipboard", () => {
  it("collects image files from clipboard items", () => {
    const file = makeFile("paste.png", "image/png");
    const items = [
      { type: "image/png", getAsFile: () => file },
      { type: "text/plain", getAsFile: () => null },
    ] as unknown as DataTransferItemList;

    const clipboard = { items } as ClipboardEvent["clipboardData"];
    const result = collectFilesFromClipboard(clipboard);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(file);
  });

  it("returns empty when clipboard has no images", () => {
    const items = [{ type: "text/plain", getAsFile: () => null }] as unknown as DataTransferItemList;
    const clipboard = { items } as ClipboardEvent["clipboardData"];
    expect(collectFilesFromClipboard(clipboard)).toHaveLength(0);
  });

  it("returns empty when clipboardData is null", () => {
    expect(collectFilesFromClipboard(null)).toHaveLength(0);
  });
});

describe("collectFilesFromDataTransfer", () => {
  it("collects image files from dataTransfer.files", () => {
    const file = makeFile("drop.png", "image/png");
    const dt = {
      files: {
        length: 1,
        0: file,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as FileList,
    } as DataTransfer;

    const result = collectFilesFromDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("drop.png");
  });

  it("filters invalid files from dataTransfer", () => {
    const bad = makeFile("x.pdf", "application/pdf");
    const good = makeFile("y.png", "image/png");
    const list = [bad, good];
    const dt = {
      files: list as unknown as FileList,
    } as DataTransfer;
    const result = collectFilesFromDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("y.png");
  });
});

describe("ALLOWED_IMAGE_TYPES", () => {
  it("includes standard web image formats", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
  });
});
