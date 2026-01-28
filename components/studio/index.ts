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
} from "./studio-provider";

// Studio Frame Components
export {
  StudioFrame,
  StudioHeader as StudioHeaderFrame,
  StudioLayout,
  StudioSidebar as StudioSidebarFrame,
  StudioMainPanel,
  StudioSettingsPanel,
  StudioResultsPanel,
} from "./studio-frame";

// Studio Header Components
export {
  StudioHeader,
  StudioHeaderBrand,
  StudioHeaderTitle,
  StudioHeaderCredits,
  StudioHeaderUser,
} from "./studio-header";

// Studio Sidebar Components (left navigation)
export {
  StudioSidebar,
  StudioSidebarNav,
  StudioSidebarCredits,
  StudioSidebarUser,
  StudioSidebarToggle,
} from "./studio-sidebar";

// Studio Settings Sidebar Components (right panel)
export {
  StudioSettingsSidebar,
  StudioSettingsSidebarHeader,
  StudioSettingsSidebarCollapsed,
  StudioSettingsSidebarContent,
} from "./studio-settings-sidebar";

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
} from "./studio-generator";

// Studio Results Components
export {
  StudioResults,
  StudioResultsHeader,
  StudioResultsError,
  StudioResultsGrid,
  StudioResultsLoadMore,
} from "./studio-results";

// Thumbnail Components (optimized)
export {
  ThumbnailCard,
  ThumbnailCardSkeleton,
  ThumbnailCardEmpty,
  type ThumbnailCardProps,
} from "./thumbnail-card";

export {
  ThumbnailGrid,
  ThumbnailGridSkeleton,
  type ThumbnailGridProps,
} from "./thumbnail-grid";

// Face Components
export {
  FaceCard,
  FaceCardCompact,
  FaceCardSkeleton,
  type FaceCardProps,
} from "./face-card";

export {
  FaceEditor,
  type FaceEditorProps,
} from "./face-editor";

// Gallery Controls
export {
  GalleryControls,
  type GalleryControlsProps,
} from "./gallery-controls";

// Browse Controls
export {
  BrowseControls,
  type BrowseControlsProps,
} from "./browse-controls";

// Style Components (for both browse and my styles views)
export {
  StyleCard,
  StyleCardSkeleton,
  StyleCardEmpty,
  type StyleCardProps,
} from "./style-card";

export {
  StyleThumbnailCard,
  StyleThumbnailCardSkeleton,
  StyleThumbnailCardEmpty,
  type StyleThumbnailCardProps,
} from "./style-thumbnail-card";

export {
  StyleGrid,
  StyleGridSkeleton,
  type StyleGridProps,
} from "./style-grid";

// Palette Components (for browse and manage views)
export {
  PaletteThumbnailCard,
  PaletteColorStrip,
  type PaletteThumbnailCardProps,
} from "./palette-thumbnail-card";
export {
  PaletteCard,
  PaletteCardSkeleton,
  PaletteCardEmpty,
  type PaletteCardProps,
} from "./palette-card";

export {
  PaletteGrid,
  PaletteGridSkeleton,
  type PaletteGridProps,
} from "./palette-grid";

// Browse Tab Components
export { BrowseThumbnails } from "./browse-thumbnails";
export { BrowseStyles, type BrowseStylesProps } from "./browse-styles";
export { BrowsePalettes, type BrowsePalettesProps } from "./browse-palettes";

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
} from "./studio-views";
