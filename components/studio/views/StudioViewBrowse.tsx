"use client";

/**
 * StudioViewBrowse
 * Browse view - browse public content with tabs for thumbnails, styles, and palettes.
 */

import React, { useState, useCallback, useEffect, memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Droplets, ImageIcon } from "lucide-react";
import { BrowseThumbnails } from "@/components/studio/browse-thumbnails";
import { BrowseStyles } from "@/components/studio/browse-styles";
import { BrowsePalettes } from "@/components/studio/browse-palettes";
import { usePrefetchPublicContent } from "@/lib/hooks/usePublicContent";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

type BrowseTab = "thumbnails" | "styles" | "palettes";

function StudioViewBrowse() {
  const [activeTab, setActiveTab] = useState<BrowseTab>("thumbnails");
  const { prefetchThumbnails, prefetchStyles, prefetchPalettes } = usePrefetchPublicContent();

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as BrowseTab);
  }, []);

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "studio.browse",
      anchorsPresent: ["tour.studio.browse.grid.container.main"],
    });
  }, []);

  const handleTabHover = useCallback(
    (tab: BrowseTab) => {
      switch (tab) {
        case "thumbnails":
          prefetchThumbnails();
          break;
        case "styles":
          prefetchStyles();
          break;
        case "palettes":
          prefetchPalettes();
          break;
      }
    },
    [prefetchThumbnails, prefetchStyles, prefetchPalettes]
  );

  return (
    <div data-tour="tour.studio.browse.grid.container.main">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Browse</h1>
        <p className="text-muted-foreground">Discover public content from the community</p>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList variant="default" className="w-full flex gap-2 p-1">
          <TabsTrigger
            value="thumbnails"
            title="Thumbnails"
            aria-label="Thumbnails"
            variant="primary"
            size="lg"
            onMouseEnter={() => handleTabHover("thumbnails")}
            onFocus={() => handleTabHover("thumbnails")}
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Thumbnails</span>
          </TabsTrigger>
          <TabsTrigger
            value="styles"
            title="Styles"
            aria-label="Styles"
            variant="primary"
            size="lg"
            onMouseEnter={() => handleTabHover("styles")}
            onFocus={() => handleTabHover("styles")}
          >
            <Palette className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Styles</span>
          </TabsTrigger>
          <TabsTrigger
            value="palettes"
            title="Palettes"
            aria-label="Palettes"
            variant="primary"
            size="lg"
            onMouseEnter={() => handleTabHover("palettes")}
            onFocus={() => handleTabHover("palettes")}
          >
            <Droplets className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Palettes</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="thumbnails" className="m-0">
          <BrowseThumbnails />
        </TabsContent>
        <TabsContent value="styles" className="m-0">
          <BrowseStyles />
        </TabsContent>
        <TabsContent value="palettes" className="m-0">
          <BrowsePalettes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default memo(StudioViewBrowse);
