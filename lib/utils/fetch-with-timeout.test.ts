/**
 * Unit tests for fetchWithTimeout.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with response when fetch completes within timeout", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const p = fetchWithTimeout("/api/test", { timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(10);
    const result = await p;

    expect(result).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    fetchSpy.mockRestore();
  });

  it("rejects when timeout is exceeded", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise<Response>(() => {}));

    const p = fetchWithTimeout("/api/slow", { timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(150);

    await expect(p).rejects.toThrow();
    fetchSpy.mockRestore();
  });

  it("calls fetch without signal when timeoutMs is omitted", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout("/api/test", {});
    expect(result).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith("/api/test", {});
    fetchSpy.mockRestore();
  });
});
