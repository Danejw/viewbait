/**
 * Hooks Index
 * 
 * Re-exports all hooks for cleaner imports.
 * 
 * @example
 * import { useAuth, useSubscription, useThumbnails } from '@/lib/hooks'
 */

export { AuthProvider, useAuth, useRequireAuth } from './useAuth'
export { SubscriptionProvider, useSubscription, useSubscriptionTiers } from './useSubscription'
export { 
  useThumbnails, 
  useDeleteThumbnail,
  useToggleFavorite,
  usePrefetchThumbnails,
  thumbnailsQueryKeys,
  type UseThumbnailsOptions 
} from './useThumbnails'
export { useStyles, type UseStylesOptions, type UseStylesReturn } from './useStyles'
export { usePalettes, type UsePalettesOptions, type UsePalettesReturn } from './usePalettes'
export { useFaces, type UseFacesOptions, type UseFacesReturn } from './useFaces'
export { 
  useFavorites, 
  useFavoriteStyles, 
  useFavoritePalettes, 
  useFavoriteThumbnails,
  type UseFavoritesOptions, 
  type UseFavoritesReturn,
  type FavoriteItemType 
} from './useFavorites'
export { useNotifications, type UseNotificationsOptions, type UseNotificationsReturn } from './useNotifications'
export { useGeneratorForm, type UseGeneratorFormReturn } from './useGeneratorForm'
export { useGeneratorSettings, type UseGeneratorSettingsReturn } from './useGeneratorSettings'
export { 
  useThumbnailGeneration, 
  type UseThumbnailGenerationReturn,
  type GenerationRequest,
  type GenerationResult,
  type ThumbnailGenerationState
} from './useThumbnailGeneration'
export { useModalManager, type UseModalManagerReturn } from './useModalManager'
export { useGeneratorMode, type UseGeneratorModeReturn } from './useGeneratorMode'
export { useGridZoom } from './useGridZoom'
export {
  useYouTubeVideosList,
  type UseYouTubeVideosListReturn,
  type YouTubeVideoItem,
} from './useYouTubeVideosList'
export {
  useThumbnailLivePeriodsBatch,
  type UseThumbnailLivePeriodsBatchOptions,
} from './useThumbnailLivePeriodsBatch'
export {
  useThumbnailComments,
  usePostThumbnailComment,
  thumbnailCommentsQueryKeys,
  type UseThumbnailCommentsOptions,
  type UsePostThumbnailCommentOptions,
} from './useThumbnailComments'