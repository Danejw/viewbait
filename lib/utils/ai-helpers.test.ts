/**
 * Unit tests for server-side AI image helper utilities.
 */

import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchImageAsBase64 } from "@/lib/utils/ai-helpers";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

vi.mock("@/lib/server/utils/logger", () => ({
  logError: vi.fn(),
}));

const lookupMock = vi.mocked(lookup);

function imageResponse(body = "image-bytes", contentType = "image/png"): Response {
  return new Response(new Blob([body], { type: contentType }), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

describe("fetchImageAsBase64", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns embedded data URLs without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());

    const result = await fetchImageAsBase64("data:image/png;base64,aGVsbG8=");

    expect(result).toEqual({ data: "aGVsbG8=", mimeType: "image/png" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks link-local URLs before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());

    const result = await fetchImageAsBase64("http://169.254.169.254/latest/meta-data/");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks hostnames that resolve to private addresses before fetching", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.7", family: 4 }] as Awaited<
      ReturnType<typeof lookup>
    >);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());

    const result = await fetchImageAsBase64("https://images.example.test/private.png");

    expect(result).toBeNull();
    expect(lookupMock).toHaveBeenCalledWith("images.example.test", { all: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects non-image responses", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as Awaited<
      ReturnType<typeof lookup>
    >);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );

    const result = await fetchImageAsBase64("https://images.example.test/file.txt");

    expect(result).toBeNull();
  });

  it("rejects responses over the image size limit without reading the body", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as Awaited<
      ReturnType<typeof lookup>
    >);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("small body", {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(5 * 1024 * 1024 + 1),
        },
      })
    );

    const result = await fetchImageAsBase64("https://images.example.test/huge.png");

    expect(result).toBeNull();
  });
});
