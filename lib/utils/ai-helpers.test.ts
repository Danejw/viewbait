/**
 * Unit tests for server-side AI image helper utilities.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchImageAsBase64 } from "@/lib/utils/ai-helpers";

const dnsMock = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: dnsMock,
  lookup: dnsMock.lookup,
}));

vi.mock("@/lib/server/utils/logger", () => ({
  logError: vi.fn(),
}));

const lookupMock = dnsMock.lookup;

function imageResponse(body = "image-bytes", contentType = "image/png"): Response {
  return new Response(new Blob([body], { type: contentType }), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

describe("fetchImageAsBase64", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
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
    lookupMock.mockResolvedValue([{ address: "10.0.0.7", family: 4 }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/private.png"
    );

    expect(result).toBeNull();
    expect(lookupMock).toHaveBeenCalledWith("project-ref.supabase.co", { all: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks arbitrary public hosts before fetching", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());

    const result = await fetchImageAsBase64("https://images.example.test/public.png");

    expect(result).toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches allowed Supabase storage images", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse("hello", "image/png"));

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/reference.png"
    );

    expect(result).toEqual({ data: "aGVsbG8=", mimeType: "image/png" });
  });

  it("revalidates redirect destinations before fetching them", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://images.example.test/redirected.png" },
      })
    );

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/redirect.png"
    );

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("follows redirects to another trusted public image URL", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://project-ref.supabase.co/storage/v1/object/sign/final.png",
          },
        })
      )
      .mockResolvedValueOnce(imageResponse("redirected", "image/png"));

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/redirect.png"
    );

    expect(result).toEqual({ data: "cmVkaXJlY3RlZA==", mimeType: "image/png" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects non-image responses", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/file.txt"
    );

    expect(result).toBeNull();
  });

  it("rejects responses over the image size limit without reading the body", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("small body", {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(5 * 1024 * 1024 + 1),
        },
      })
    );

    const result = await fetchImageAsBase64(
      "https://project-ref.supabase.co/storage/v1/object/sign/huge.png"
    );

    expect(result).toBeNull();
  });
});
