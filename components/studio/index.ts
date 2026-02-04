// Studio Provider
export {
  StudioProvider,
  useStudio,
  useThumbnailActions,
  useStyleActions,
  usePaletteActions,
  type StudioState,
  type StudioActions,
  type StudioMeta,
  type StudioData,
  type StudioContextValue,
} from "@/components/studio/studio-provider";

// Studio DnD Context (wraps generator for drag-and-drop)
export { StudioDndContext } from "@/components/studio/studio-dnd-context";

// Studio Frame Components
export {
  StudioFrame,
  StudioHeader as StudioHeaderFrame,
  StudioLayout,
  StudioLayoutResponsive,
  StudioSidebar as StudioSidebarFrame,
  StudioMainPanel,
  StudioSettingsPanel,
  StudioResultsPanel,
} from "@/components/studio/studio-frame";

// Studio Header Components
export {
  StudioHeader,
  StudioHeaderBrand,
  StudioHeaderTitle,
  StudioHeaderCredits,
  StudioHeaderUser,
} from "@/components/studio/studio-header";

// Studio Sidebar Components (left navigation)
export {
  StudioSidebar,
  StudioSidebarNav,
  StudioSidebarCredits,
  StudioSidebarUser,
  StudioSidebarToggle,
  navItems,
  type NavItem,
} from "@/components/studio/studio-sidebar";

// Studio Mobile Floating Nav (mobile-only)
export { StudioMobileFloatingNav } from "@/components/studio/studio-mobile-floating-nav";

// Studio Settings Sidebar Components (right panel)
export {
  StudioSettingsSidebar,
  StudioSettingsSidebarHeader,
  StudioSettingsSidebarCollapsed,
  StudioSettingsSidebarContent,
} from "@/components/studio/studio-settings-sidebar";

// Studio Generator Components
export {
  StudioGenerator,
  StudioGeneratorTabs,
  StudioGeneratorThumbnailText,
  StudioGeneratorCustomInstructions,
  StudioGeneratorStyleReferences,
  StudioGeneratorStyleSelection,
  StudioGeneratorPalette,
  StudioGeneratorAspectRatio,
  StudioGeneratorResolution,
  StudioGeneratorAspectAndResolution,
  StudioGeneratorVariations,
  StudioGeneratorFaces,
  StudioGeneratorSubmit,
} from "@/components/studio/studio-generator";

export {
  ProjectSelector,
  PROJECT_NONE_VALUE,
  type ProjectSelectorProps,
} from "@/components/studio/project-selector";

// Studio Results Components
export {
  StudioResults,
  StudioResultsHeader,
  StudioResultsError,
  StudioResultsGrid,
  StudioResultsLoadMore,
} from "@/components/studio/studio-results";

// Thumbnail Components (optimized)
export {
  ThumbnailCard,
  ThumbnailCardSkeleton,
  ThumbnailCardEmpty,
  type ThumbnailCardProps,
} from "@/components/studio/thumbnail-card";

export {
  ThumbnailGrid,
  ThumbnailGridSkeleton,
  type ThumbnailGridProps,
} from "@/components/studio/thumbnail-grid";

// Face Components
export {
  FaceCard,
  FaceCardCompact,
  FaceCardSkeleton,
  type FaceCardProps,
} from "@/components/studio/face-card";

export {
  FaceEditor,
  type FaceEditorProps,
} from "@/components/studio/face-editor";

// Gallery Controls
export {
  GalleryControls,
  type GalleryControlsProps,
} from "@/components/studio/gallery-controls";

// Browse Controls
export {
  BrowseControls,
  type BrowseControlsProps,
} from "@/components/studio/browse-controls";

// Style Components (for both browse and my styles views)
export {
  StyleCard,
  StyleCardSkeleton,
  StyleCardEmpty,
  type StyleCardProps,
} from "@/components/studio/style-card";

export {
  StyleThumbnailCard,
  StyleThumbnailCardSkeleton,
  StyleThumbnailCardEmpty,
  type StyleThumbnailCardProps,
} from "@/components/studio/style-thumbnail-card";

export {
  StyleGrid,
  StyleGridSkeleton,
  type StyleGridProps,
} from "@/components/studio/style-grid";

// Palette Components (for browse and manage views)
export {
  PaletteThumbnailCard,
  PaletteColorStrip,
  type PaletteThumbnailCardProps,
} from "@/components/studio/palette-thumbnail-card";
export {
  PaletteCard,
  PaletteCardSkeleton,
  PaletteCardEmpty,
  type PaletteCardProps,
} from "@/components/studio/palette-card";

export {
  PaletteGrid,
  PaletteGridSkeleton,
  type PaletteGridProps,
} from "@/components/studio/palette-grid";

// Browse Tab Components
export { BrowseThumbnails } from "@/components/studio/browse-thumbnails";
export { BrowseStyles, type BrowseStylesProps } from "@/components/studio/browse-styles";
export { BrowsePalettes, type BrowsePalettesProps } from "@/components/studio/browse-palettes";

// Studio Views Components
export {
  StudioMainContent,
  StudioView,
  StudioViewGallery,
  StudioViewBrowse,
  StudioViewStyles,
  StudioViewPalettes,
  StudioViewFaces,
  StudioViewYouTube,
} from "@/components/studio/studio-views";
export { StudioViewUpdates } from "@/components/studio/studio-view-updates";
export {
  StudioAssistantPanel,
  AssistantDataCard,
  type AssistantMessage,
  type StudioAssistantPanelProps,
} from "@/components/studio/studio-assistant-panel";
