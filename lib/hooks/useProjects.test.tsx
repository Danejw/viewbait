/**
 * Tests for useProjects and useSharedProjectGallery.
 * Validates visibility-aware polling: refetch when tab visible, pause when hidden.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useSharedProjectGallery } from "@/lib/hooks/useProjects";

const mockGalleryData = {
  projectName: "Test Project",
  shareMode: "all" as const,
  thumbnails: [],
  count: 0,
};

vi.mock("@/lib/services/projects", () => ({
  getSharedProjectGallery: vi.fn(),
}));

import * as projectsService from "@/lib/services/projects";

const getSharedProjectGallerySpy = vi.mocked(
  projectsService.getSharedProjectGallery
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function setDocumentVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value,
    configurable: true,
    writable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useSharedProjectGallery", () => {
  beforeEach(() => {
    getSharedProjectGallerySpy.mockReset();
    getSharedProjectGallerySpy.mockResolvedValue({
      data: mockGalleryData,
      error: null,
    });
    setDocumentVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches gallery on mount when slug is provided", async () => {
    const wrapper = createWrapper();
    renderHook(() => useSharedProjectGallery("some-slug"), { wrapper });
    await waitFor(() => {
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);
      expect(getSharedProjectGallerySpy).toHaveBeenCalledWith("some-slug");
    });
  });

  it("polls every 2 minutes when tab is visible", { timeout: 10000 }, async () => {
      vi.useFakeTimers();
      const wrapper = createWrapper();
      renderHook(() => useSharedProjectGallery("some-slug"), { wrapper });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();
      });
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(3);
  });

  it("stops polling when tab is hidden", { timeout: 10000 }, async () => {
    vi.useFakeTimers();
    const wrapper = createWrapper();
    renderHook(() => useSharedProjectGallery("some-slug"), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);

    await act(() => {
      setDocumentVisibility("hidden");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120 * 1000);
      await Promise.resolve();
    });
    expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);
  });

  it("resumes polling when tab becomes visible again", { timeout: 10000 }, async () => {
      vi.useFakeTimers();
      const wrapper = createWrapper();
      renderHook(() => useSharedProjectGallery("some-slug"), { wrapper });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();
      });
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);

      await act(() => {
        setDocumentVisibility("hidden");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120 * 1000);
        await Promise.resolve();
      });
      expect(getSharedProjectGallerySpy).toHaveBeenCalledTimes(1);

      getSharedProjectGallerySpy.mockClear();
      await act(() => {
        setDocumentVisibility("visible");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
        await Promise.resolve();
      });
      expect(getSharedProjectGallerySpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
