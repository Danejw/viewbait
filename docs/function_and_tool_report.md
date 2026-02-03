# Function and Tool Report

**Generated:** 2025-02-02  
**Scope:** Recursive scan of the Viewbait codebase (TypeScript/TSX).  
**Purpose:** Exhaustive list of defined functions and identification of candidates suitable for conversion into agent tools.

---

## 1. Functions by Location

Functions are listed with **name**, **signature** (parameters and return type where inferable), and **brief description** when available from docstrings or preceding comments.

---

### 1.1 `lib/utils`

| Function | Signature | Description |
|----------|-----------|-------------|
| `parsePartToSeconds` | `(part: string) => number \| null` | Parses a single timestamp string (e.g. "0:30", "1:15") to seconds. Returns null if unparseable. |
| `parseRangeToSeconds` | `(range: string) => [number, number] \| null` | Parses a range string like "0:30–1:15" to [startSeconds, endSeconds]. |
| `getRepresentativeSecondsFromScenes` | `(scenes: Array<{ part: string; description?: string }>) => number` | Returns one representative timestamp (midpoint of range or single time) from scenes. Internal. |
| `getRepresentativeSecondsForCharacter` | `(character: CharacterWithScenes) => number \| null` | Representative timestamp in seconds for a character's first parseable scene. |
| `getRepresentativeSecondsForPlace` | `(place: PlaceWithScenes) => number \| null` | Same as character; for places in video analytics. |
| `getCombinedThumbnailsList` | `(thumbnails: Thumbnail[], generatingItems: Map<string, Thumbnail>) => Thumbnail[]` | Builds combined list: generating items (newest first) then DB thumbnails, no duplicates. |
| `extractSafeErrorInfo` | `(error: unknown) => { type: string; code?: string; message?: string }` | Extracts safe error info (no PII, no stack). Internal. |
| `redactContext` | `(context: ClientLogContext) => ClientLogContext` | Redacts PII from context. Internal. |
| `logClientError` | `(error: unknown, context?: ClientLogContext) => void` | Client-side safe error logging. |
| `logClientWarn` | `(message: string, context?: ClientLogContext) => void` | Client-side warn logging. |
| `logClientInfo` | `(message: string, context?: ClientLogContext) => void` | Client-side info logging. |
| `reportErrorToServer` | `(error: unknown, context?: ClientLogContext) => Promise<void>` | Sends error report to server. Internal. |
| `getItemSafe` | `(key: string) => string \| null` | Returns localStorage item or null on any error; does not throw. |
| `setItemWithCap` | `(key: string, payload: string, options?: SetItemWithCapOptions) => void` | Sets item with optional size cap and trim; never throws. |
| `blobToJpeg` | `(blob: Blob, quality?: number) => Promise<Blob>` | Converts image blob to JPEG; default quality 0.92. |
| `normalizeEmotionKey` | `(emotion: string) => string` | Normalizes emotion key for lookup. Internal. |
| `getEmotionDescription` | `(emotion?: string) => string` | Returns emotion description from key (for prompts). |
| `getPoseDescription` | `(pose?: string) => string` | Returns pose description from key. |
| `getResolutionDimensions` | `(resolution: '1K' \| '2K' \| '4K', aspectRatio: string) => { width: number; height: number }` | Computes width/height from resolution and aspect ratio. |
| `fetchImageAsBase64` | `(imageUrl: string) => Promise<{ data: string; mimeType: string } \| null>` | Fetches image from URL (or data URL) and returns base64 + mimeType. |
| `luminanceHex` | `(hex: string) => number` | Computes relative luminance from hex color. |
| `applyQrWatermarkToCanvas` | `(canvas, options) => Promise<void>` | Applies QR watermark to canvas. |
| `applyQrWatermark` | `(blob: Blob, options?: WatermarkOptions) => Promise<Blob>` | Applies QR watermark to image blob. |
| `getLogoAsImage` | `(colorHex: string) => Promise<HTMLImageElement>` | Loads logo as HTMLImageElement. |
| `getQrDataUrl` | `(data: string, options?) => string` | Returns data URL for QR code. |
| `getQrAsImage` | `(data: string, options?) => Promise<HTMLImageElement>` | Returns QR as image element. |
| `getResolutionBadgeColor` | `(resolution: string \| null \| undefined) => string` | Returns badge color for resolution. |
| `retryWithBackoff` | `(fetchFn: () => Promise<Response>, options?: RetryOptions) => Promise<Response>` | Retries fetch with exponential backoff; supports timeout. |
| `sanitizeErrorForClient` | `(error: unknown, context: string, defaultMessage: string) => string` | Returns generic safe error message; logs full error server-side. |
| `sanitizeApiErrorResponse` | `(errorText: string) => string` | Redacts sensitive info from API error text. |
| `filterAndSortResources` | `<T>(resources: T[], options: FilterSortOptions) => T[]` | Generic filter and sort for resources. |
| `isCriticalSelector` | `(selector: string) => boolean` | Returns whether selector is critical for CSS. |
| `isNonCriticalSelector` | `(selector: string) => boolean` | Returns whether selector is non-critical. |
| `generateBlurDataURL` | `(width: number, height: number) => string` | Generates blur data URL placeholder. |
| `generateSVGBlurPlaceholder` | `(width: number, height: number) => string` | Generates SVG blur placeholder. |
| `generateBlurFromImage` | `(imageUrl: string) => Promise<string>` | Generates blur placeholder from image URL. |
| `getDefaultBlurPlaceholder` | `() => string` | Returns default blur placeholder. |
| `generateBlurServerSide` | `(imageUrl: string) => Promise<string>` | Server-side blur placeholder from URL. |
| `processGroundingCitations` | `(citations: unknown) => ProcessedCitation[]` | Processes grounding citations. |
| `clearSupabaseCookies` | `() => void` | Clears Supabase auth cookies. |

---

### 1.2 `lib/server/utils`

| Function | Signature | Description |
|----------|-----------|-------------|
| `shouldRefreshUrl` | `(url: string) => boolean` | True if signed URL is expired or within refresh threshold. |
| `extractStoragePath` | `(url: string, bucket: BucketName) => string \| null` | Extracts storage path from signed Supabase storage URL. |
| `refreshSingleUrl` | `(supabase, bucket, url, fallbackPath?) => Promise<string>` | Refreshes a single signed URL; uses in-memory cache. |
| `clearUrlCache` | `() => void` | Clears in-memory URL cache. |
| `refreshThumbnailUrls` | `(supabase, thumbnails, userId) => Promise<T[]>` | Refreshes thumbnail image_urls. |
| `refreshFaceUrls` | `(supabase, faces, userId) => Promise<T[]>` | Refreshes face image_urls. |
| `refreshStyleUrls` | `(supabase, styles) => Promise<T[]>` | Refreshes style reference_images. |
| `refreshSignedUrl` | `(supabase, bucket, path, expiry?) => Promise<string>` | Creates signed URL for storage path. |
| `getTierForUser` | `(userId: string) => Promise<TierConfig>` | Fetches tier config for user. |
| `getTierNameForUser` | `(userId: string) => Promise<TierName>` | Fetches tier name for user. |
| `hashUserId` | `(userId: string) => string` | Hashes user ID for logging. Internal. |
| `redactPII` | `(data: unknown) => unknown` | Redacts PII from log data. Internal. |
| `extractErrorInfo` | `(error: unknown) => object` | Extracts error info for logging. Internal. |
| `formatLogEntry` | `(...) => string` | Formats log entry. Internal. |
| `logError` | `(error: unknown, context?: object) => void` | Server-side error logging. |
| `logWarn` | `(message: string, context?: object) => void` | Server-side warn. |
| `logInfo` | `(message: string, context?: object) => void` | Server-side info. |
| `logDebug` | `(message: string, context?: object) => void` | Server-side debug. |
| `unauthorizedResponse` | `(message?: string) => NextResponse` | 401 JSON response. |
| `notFoundResponse` | `(message?: string) => NextResponse` | 404 JSON response. |
| `validationErrorResponse` | `(message: string) => NextResponse` | 400 JSON response. |
| `forbiddenResponse` | `(message: string, details?: object) => NextResponse` | 403 JSON response. |
| `serverErrorResponse` | `(error, message?, context?) => NextResponse` | 500 JSON response. |
| `databaseErrorResponse` | `(message?: string) => NextResponse` | 500 database error response. |
| `configErrorResponse` | `(message?: string) => NextResponse` | 500 config error response. |
| `insufficientCreditsResponse` | `(creditsRemaining: number, required: number) => NextResponse` | 403 insufficient credits. |
| `tierLimitResponse` | `(message: string) => NextResponse` | 403 tier limit. |
| `subscriptionErrorResponse` | `(message?: string) => NextResponse` | 500 subscription error. |
| `storageErrorResponse` | `(error, message?, context?) => NextResponse` | 500 storage error. |
| `aiServiceErrorResponse` | `(error, message?, context?) => NextResponse` | 500 AI service error. |
| `stripeErrorResponse` | `(error, message?, context?) => NextResponse` | 500 Stripe error. |

---

### 1.3 `lib/services`

| Function | Signature | Description |
|----------|-----------|-------------|
| `getYouTubeIntegration` | `(userId: string) => Promise<... \| null>` | Gets YouTube integration for user. |
| `refreshGoogleToken` | `(refreshToken: string) => Promise<TokenRefreshResult>` | Refreshes Google OAuth token. Internal. |
| `ensureValidToken` | `(userId: string) => Promise<string \| null>` | Ensures valid access token for YouTube. |
| `fetchYouTubeChannel` | `(accessToken: string) => Promise<...>` | Fetches channel info from YouTube API. |
| `storeChannelData` | `(userId, channelData) => Promise<void>` | Stores channel data in DB. |
| `fetchYouTubeAnalytics` | `(accessToken, channelId, dateRange) => Promise<...>` | Fetches analytics. |
| `storeAnalyticsData` | `(userId, analytics) => Promise<void>` | Stores analytics. |
| `formatDateForAnalytics` | `(date: Date) => string` | YYYY-MM-DD for YouTube Analytics API. |
| `getDateRangeForLastNDays` | `(days: number) => { startDate: string; endDate: string }` | Date range for last N days. |
| `isYouTubeConnected` | `(userId: string) => Promise<boolean>` | Whether user has YouTube connected. |
| `fetchVideoDetailsFromDataAPI` | `(accessToken, videoIds) => Promise<VideoDetails[]>` | Video details from Data API. |
| `fetchPerVideoAnalytics` | `(accessToken, videoIds, dateRange) => Promise<...>` | Per-video analytics. |
| `fetchVideoAnalyticsTimeSeries` | `(...) => Promise<...>` | Time series analytics. |
| `fetchVideoTrafficSources` | `(...) => Promise<...>` | Traffic sources. |
| `fetchVideoImpressions` | `(...) => Promise<...>` | Impressions. |
| `analyzeYouTubeVideo` | `(videoId: string, ...) => Promise<...>` | Analyzes YouTube video (e.g. characters/places). |
| `getThumbnails` | `(params?) => Promise<{ data: Thumbnail[]; ... }>` | List thumbnails with filters. |
| `getThumbnail` | `(id: string) => Promise<{ ... }>` | Single thumbnail by id. |
| `createThumbnail` | `(payload) => Promise<...>` | Creates thumbnail record. |
| `updateThumbnail` | `(id, payload) => Promise<...>` | Updates thumbnail. |
| `updateThumbnailProject` | `(id, projectId) => Promise<...>` | Moves thumbnail to project. |
| `deleteThumbnail` | `(id: string) => Promise<void>` | Deletes thumbnail. |
| `toggleThumbnailFavorite` | `(id: string) => Promise<...>` | Toggles favorite. |
| `toggleThumbnailPublic` | `(id: string) => Promise<...>` | Toggles public. |
| `getPublicThumbnails` | `(params?) => Promise<...>` | Public thumbnails. |
| `searchThumbnails` | `(query, params?) => Promise<...>` | Search thumbnails. |
| `generateThumbnail` | `(options) => Promise<...>` | Calls generate API. |
| `editThumbnail` | `(options) => Promise<...>` | Calls edit API. |
| `enhanceTitle` | `(title: string) => Promise<...>` | AI title enhancement. |
| `analyzeThumbnailStyleForInstructions` | `(params) => Promise<...>` | Analyzes style for instructions. |
| `getStyles` | `(userId: string) => Promise<...>` | User's styles. |
| `getUserStyles` | `(userId: string) => Promise<...>` | User styles (alias/similar). |
| `getPublicStyles` | `() => Promise<...>` | Public styles. |
| `getDefaultStyles` | `() => Promise<...>` | Default styles. |
| `getStyle` | `(id: string) => Promise<...>` | Single style. |
| `createStyle` | `(payload) => Promise<...>` | Create style. |
| `updateStyle` | `(id, payload) => Promise<...>` | Update style. |
| `deleteStyle` | `(id: string) => Promise<void>` | Delete style. |
| `toggleStylePublic` | `(id: string) => Promise<...>` | Toggle style public. |
| `addStyleReferenceImages` | `(id, urls) => Promise<...>` | Add reference images. |
| `removeStyleReferenceImage` | `(id, url) => Promise<...>` | Remove reference image. |
| `updateStylePreview` | `(id, url) => Promise<...>` | Update style preview. |
| `analyzeStyle` | `(files: File[]) => Promise<...>` | Analyze style from files. |
| `extractStyleFromYouTube` | `(videoUrl: string) => Promise<...>` | Extract style from YouTube. |
| `generateStylePreview` | `(id: string) => Promise<...>` | Generate style preview. |
| `getFFmpeg` | `() => Promise<FFmpeg>` | Gets FFmpeg instance. Internal. |
| `extractFramesAt` | `(videoUrl, timestamps, options?) => Promise<Blob[]>` | Extracts frames at given seconds. |
| `callGeminiImageGeneration` | `(params) => Promise<...>` | Gemini image generation. |
| `callGeminiTextGeneration` | `(params) => Promise<...>` | Gemini text generation. |
| `callGeminiWithFunctionCalling` | `(params) => Promise<...>` | Gemini with function calling. |
| `callGeminiWithYouTubeVideoAndFunctionCalling` | `(params) => Promise<...>` | Gemini with video + function calling. |
| `callGeminiWithYouTubeVideoAndStructuredOutput` | `(params) => Promise<...>` | Gemini video + structured output. |
| `callGeminiImageGenerationSimple` | `(params) => Promise<...>` | Simplified image generation. |
| `callGeminiImageEdit` | `(params) => Promise<...>` | Gemini image edit. |
| `getStripe` | `() => Stripe` | Stripe instance. Internal. |
| `checkSubscription` | `(userId: string) => Promise<...>` | Check subscription status. |
| `getOrCreateStripeCustomer` | `(userId, email?) => Promise<...>` | Internal. |
| `getStripeMode` | `() => 'test' \| 'live'` | Internal. |
| `createCheckoutSession` | `(userId, priceId, ...) => Promise<...>` | Creates Stripe checkout. |
| `processCheckoutSession` | `(sessionId: string) => Promise<...>` | Processes checkout. |
| `recordPurchaseAndProcessReferrals` | `(...) => Promise<...>` | Records purchase and referrals. |
| `createCustomerPortalSession` | `(userId: string) => Promise<...>` | Customer portal URL. |
| `getProfile` | `() => Promise<...>` | Current user profile. |
| `updateProfile` | `(payload) => Promise<...>` | Update profile. |
| `getProfileById` | `(userId: string) => Promise<...>` | Profile by id. |
| `updateAvatarUrl` | `(url: string) => Promise<...>` | Update avatar. |
| `updateFullName` | `(name: string) => Promise<...>` | Update full name. |
| `markOnboardingCompleted` | `() => Promise<...>` | Mark onboarding done. |
| `submitFeedback` | `(category, message, ...) => Promise<...>` | Submit feedback (client). |
| `getSubscription` | `(userId: string) => Promise<...>` | Get subscription. |
| `checkSubscription` | `() => Promise<...>` | Check current user subscription. |
| `createCheckout` | `(priceId: string) => Promise<...>` | Create checkout session. |
| `getCustomerPortal` | `() => Promise<...>` | Customer portal URL. |
| `deductCredits` | `(userId, amount, reason) => Promise<...>` | Deduct credits. |
| `getCreditHistory` | `(userId?) => Promise<...>` | Credit history. |
| `getSubscriptionTierConfig` | `(productId: string \| null) => Promise<...>` | Tier config by product id. |
| `ensureSubscription` | `(userId: string) => Promise<...>` | Ensure subscription record. |
| `grantCredits` | `(userId, amount, reason) => Promise<...>` | Grant credits. |
| `getProjects` | `() => Promise<...>` | User projects. |
| `createProject` | `(payload) => Promise<...>` | Create project. |
| `updateProject` | `(id, payload) => Promise<...>` | Update project. |
| `deleteProject` | `(id: string) => Promise<...>` | Delete project. |
| `getSharedProjectGallery` | `(slug: string) => Promise<...>` | Shared project gallery. |
| `signInWithEmail` | `(email, password) => Promise<...>` | Email sign in. |
| `signUpWithEmail` | `(email, password, ...) => Promise<...>` | Email sign up. |
| `signInWithGoogle` | `(redirectTo?) => Promise<...>` | Google sign in. |
| `signOut` | `() => Promise<...>` | Sign out. |
| `resetPassword` | `(email: string) => Promise<...>` | Reset password. |
| `updatePassword` | `(password: string) => Promise<...>` | Update password. |
| `getSession` | `() => Promise<Session \| null>` | Current session. |
| `getUser` | `() => Promise<User \| null>` | Current user. |
| `refreshSession` | `() => Promise<AuthResult>` | Refresh session. |
| `onAuthStateChange` | `(callback) => { data: { subscription } }` | Auth state listener. |

---

### 1.4 `lib/server/data`

| Function | Signature | Description |
|----------|-----------|-------------|
| `fetchSubscription` | `() => Promise<FetchSubscriptionResult>` | Fetches subscription for current user. |
| `isFeedbackCategory` | `(value: string) => value is FeedbackCategoryValue` | Type guard for feedback category. |
| `submitFeedbackFromServer` | `(userId, category, message, ...) => Promise<...>` | Submit feedback from server. |
| `createNotification` | `(params) => Promise<...>` | Create notification. |
| `createNotificationIfNew` | `(params) => Promise<...>` | Create notification if new. |
| `buildThumbnailsQuery` | `(supabase, userId, options?) => QueryBuilder` | Builds thumbnails query. |
| `fetchThumbnails` | `(userId, options?) => Promise<...>` | Fetches thumbnails from DB. |
| `fetchPublicThumbnailsNoAuth` | `(limit?: number) => Promise<...>` | Public thumbnails without auth. |
| `fetchThumbnailsForSharedProject` | `(slug: string) => Promise<...>` | Thumbnails for shared project. |
| `listProjects` | `(userId: string) => Promise<...>` | List projects. |
| `getProjectByShareSlug` | `(slug: string) => Promise<...>` | Project by share slug. |
| `getProjectById` | `(id: string, userId: string) => Promise<...>` | Project by id. |
| `createProject` | `(userId, payload) => Promise<...>` | Create project. |
| `updateProject` | `(id, userId, payload) => Promise<...>` | Update project. |
| `deleteProject` | `(id: string, userId: string) => Promise<...>` | Delete project. |
| `getTierByProductId` | `(productId: string \| null) => Promise<TierConfig>` | Tier config by Stripe product id. |
| `getTierByName` | `(tierName: TierName) => Promise<TierConfig>` | Tier config by name (cached). |
| `getTierNameByProductId` | `(productId: string \| null) => Promise<TierName>` | Tier name by product id. |
| `getAllTiers` | `() => Promise<Record<TierName, TierConfig>>` | All tiers (cached). |
| `invalidateTiersCache` | `() => void` | Invalidates tier cache. |
| `getResolutionCredits` | `() => Promise<Record<Resolution, number>>` | Credit cost per resolution. |
| `getEditCreditCost` | `() => Promise<number>` | Credit cost for edit. |
| `invalidateSettingsCache` | `() => void` | Invalidates settings cache. |

(Additional internal helpers in these files: `getStripeMode`, `getModeAwareProductId`, `getModeAwarePriceId`, `dbTierToTierConfig`, `isCacheValid`, `fetchTiersFromDB`, `getTiersFromCache`, `fetchSettingsFromDB`, `getSettingsFromCache`, and URL expiry helpers in thumbnails data.)

---

### 1.5 `lib/types/database.ts` (mappers)

| Function | Signature | Description |
|----------|-----------|-------------|
| `mapDbThumbnailToThumbnail` | `(db: DbThumbnail) => Thumbnail` | DB thumbnail → frontend Thumbnail. |
| `mapDbStyleToStyle` | `(db: DbStyle) => Style` | DB style → Style. |
| `mapDbPaletteToPalette` | `(db: DbPalette) => Palette` | DB palette → Palette. |
| `mapDbFaceToFace` | `(db: DbFace) => Face` | DB face → Face. |
| `mapPublicStyleToStyle` | `(publicStyle: PublicStyle) => Style` | Public style view → Style. |
| `mapPublicPaletteToPalette` | `(publicPalette: PublicPalette) => Palette` | Public palette view → Palette. |

---

### 1.6 `lib/constants`

| Function | Signature | Description |
|----------|-----------|-------------|
| `getExpressionValues` | `() => string[]` | Array of expression values for enum. |
| `getPoseValues` | `() => string[]` | Array of pose values for enum. |
| `formatExpressionsForPrompt` | `() => string` | "excited (Excited), happy (Happy), ..." for prompts. |
| `formatPosesForPrompt` | `() => string` | "none (None), pointing (Pointing), ..." for prompts. |
| `getGenerateCooldownMs` | `(tier: TierName) => number` | Cooldown in ms for generate button. |
| `getTierByProductId` | `(productId: string \| null) => TierConfig` | Deprecated; fallback tier. |
| `getTierNameByProductId` | `(productId: string \| null) => TierName` | Deprecated; returns 'free'. |
| `canUseResolution` | `(productId, resolution: Resolution) => boolean` | Whether tier allows resolution. |
| `getResolutionCost` | `(resolution: Resolution) => number` | Credit cost for resolution. |
| `canUseEnhance` | `(productId: string \| null) => boolean` | Whether tier has enhance. |
| `hasWatermark` | `(productId: string \| null) => boolean` | Whether tier has watermark. |
| `hasEnoughCredits` | `(creditsRemaining: number, resolution: Resolution) => boolean` | Credits check. |
| `getMaxVariations` | `(productId: string \| null) => number` | Max variations for tier. |
| `canCreateCustomAssets` | `(productId: string \| null) => boolean` | Custom styles/palettes/faces. |
| `getRequiredTierForVariations` | `(variations: number) => TierName` | Min tier for N variations. |
| `getRequiredTierForResolution` | `(resolution: Resolution) => TierName` | Min tier for resolution. |

---

### 1.7 `lib/hooks`

| Function | Signature | Description |
|----------|-----------|-------------|
| `useEmptySlots` | `(total: number, used: number) => number` | Empty slots count. |
| `useYouTubeStyleExtract` | `(videoUrl: string \| null) => { ... }` | YouTube style extraction state. |
| `useYouTubeIntegration` | `() => UseYouTubeIntegrationReturn` | YouTube integration state/actions. |
| `useYouTubeConnected` | `() => { isConnected: boolean; ... }` | YouTube connected status. |
| `useStyles` | `(options?: UseStylesOptions) => UseStylesReturn` | Styles list and CRUD. |
| `useWatermarkedImage` | `(imageUrl, options?) => { ... }` | Watermarked image URL. |
| `useChannelVideos` | `(channelId \| videoId, options?) => { ... }` | Channel videos. |
| `useGeneratorState` | `() => [GeneratorState, dispatch]` | Generator form state. |
| `useLocalStorage` | `<T>(key, options) => [T, setValue, ...]` | Local storage state. |
| `useThumbnailGeneration` | `() => { ... }` | Thumbnail generation flow. |
| `useThumbnails` | `(options?) => { ... }` | Thumbnails list and actions. |
| `useDeleteThumbnail` | `() => (id: string) => Promise<...>` | Delete thumbnail mutation. |
| `useToggleFavorite` | `() => (id: string) => Promise<...>` | Toggle favorite. |
| `usePrefetchThumbnails` | `() => void` | Prefetch thumbnails. |
| `useSubscriptionTiers` | `() => { tiers, ... }` | Subscription tiers from API. |
| `useOnboarding` | `() => OnboardingContextValue` | Onboarding context. |
| `OnboardingProvider` | `({ children }) => JSX` | Onboarding provider. |
| `useProjects` | `() => UseProjectsReturn` | Projects list and CRUD. |
| `useSharedProjectGallery` | `(slug: string \| null) => { ... }` | Shared project gallery. |
| `useScrollAnimation` | `(options) => { ... }` | Scroll animation state. |
| `useReferrals` | `() => UseReferralsReturn` | Referrals state/actions. |
| `SubscriptionProvider` | `({ children }) => JSX` | Subscription provider. |
| `useSubscription` | `() => SubscriptionContextType` | Subscription context. |
| `AuthProvider` | `({ children }) => JSX` | Auth provider. |
| `useAuth` | `() => AuthContextType` | Auth context. |
| `useRequireAuth` | `() => AuthContextType & { user: User }` | Auth required (throws if no user). |
| `usePublicThumbnails` | `(options?) => { ... }` | Public thumbnails. |
| `usePublicStyles` | `(options?) => { ... }` | Public styles. |
| `usePublicPalettes` | `(options?) => { ... }` | Public palettes. |
| `usePalettes` | `(options?) => { ... }` | Palettes list and CRUD. |
| `useMediaQuery` | `(query: string) => boolean` | Media query match. |
| `useGeneratorSettings` | `() => { ... }` | Generator settings persist. |
| `useKeyboardAwareScroll` | `(options) => { ... }` | Keyboard-aware scroll. |

---

### 1.8 `lib/contexts`

| Function | Signature | Description |
|----------|-----------|-------------|
| `useOnboarding` | `() => OnboardingContextValue` | Onboarding context (re-export/defined in onboarding-context). |
| `OnboardingProvider` | `({ children }) => JSX` | Onboarding provider. |

---

### 1.9 `components` (exported components and hooks – summary)

**Studio:** `StudioChatPanel`, `StudioChatAssistant`, `StudioChatToggle`, `StudioSidebarNav`, `StudioSidebarUser`, `StudioSidebarToggle`, `StudioSidebar`, `StyleGridSkeleton`, `YouTubeVideoCardSkeleton`, `YouTubeVideoAnalyticsModal`, `ThumbnailCardSkeleton`, `ThumbnailCardFailed`, `ThumbnailCardEmpty`, `ThumbnailGridSkeleton`, `StudioViewYouTube`, `StudioMainContent`, `StudioView`, `useStudio`, `useStudioState`, `useThumbnailActions`, `useStyleActions`, `usePaletteActions`, `StudioProvider`, `StudioGeneratorTabs`, `StudioGeneratorThumbnailText`, `StudioGeneratorCustomInstructions`, `StudioGeneratorStyleReferences`, `StudioGeneratorStyleSelection`, `StudioGeneratorPalette`, `StudioGeneratorAspectRatio`, `StudioGeneratorResolution`, `StudioGeneratorAspectAndResolution`, `StudioGeneratorVariations`, `StudioGeneratorFaces`, `StudioGeneratorSubmit`, `StudioGeneratorChat`, `StudioGenerator`, `StudioDndContext`, `SnapshotViewModal`, `FaceEditor`, `PaletteGridSkeleton`, `DragOverlayPreview`, `StudioSettingsSidebarHeader`, `StudioSettingsSidebarCollapsed`, `StudioSettingsSidebarContent`, `StudioSettingsSidebar`, `StyleEditor`, `StudioMobileFloatingNav`, `StudioFrame`, `StudioHeader`, `StudioLayout`, `StudioLayoutResponsive`, `StudioSidebar` (frame), `StudioMainPanel`, `StudioSettingsPanel`, `StudioResultsPanel`, `StudioProjectSwitcher`, `ShareProjectDialog`, `DynamicUIRenderer`, `StudioResults`, `ThumbnailEditModal`, `PaletteEditor`, `StudioHeaderBrand`, `StudioHeaderTitle`, `StudioHeaderCredits`, `StudioHeaderUser`, `StudioHeader`, `DeleteConfirmationModal`, `ChatMessage`, `FaceThumbnailSkeleton`, `ProcessCheckoutOnReturn`, `ThinkingMessage`, `ThemeToggle`, `ThemeToggleSimple`, and other card/skeleton/empty components.

**Other:** `FeedbackModal`, `PwaRegister`, `VHSScrollReveal`, `LandingNav`, `PublicBetaBanner`, `LandingFooter`, `ThemeProvider`, `ViewBaitLogo`, `LegalPageView`, `ScrollReveal`, `LenisRoot`, `useLenisScroll`, `NotificationPopover`, `NotificationItem`, `NotificationBell`, `ComponentExample`, etc.

(All of the above are React components or component-level hooks, not standalone stateless utilities.)

---

### 1.10 `app` (API route handlers and page components – summary)

**API routes** export HTTP method handlers: `GET`, `POST`, `PATCH`, `DELETE`, etc. Examples:

- `app/api/assistant/chat/route.ts`: `POST` (chat); internal: `uploadBase64ToStyleReferences`, `enrichFormStateWithAttachedStyleReferences`, `uploadBase64ToFaceImage`, `enrichFormStateWithNewFaceFromAttachedImage`, `stripServerOnlyFormUpdates`, `emitSSE`.
- `app/api/youtube/*`: various GET/POST/DELETE for connect, disconnect, status, refresh, channel, channel-videos, videos, videos/[id], videos/[id]/stream, videos/[id]/set-thumbnail, videos/[id]/update-title, videos/analyze, videos/analytics, analytics.
- `app/api/thumbnails/*`: GET, POST, PATCH, DELETE, search, public, [id], [id]/favorite, [id]/public, [id]/project, analyze-style-for-instructions.
- `app/api/styles/*`, `app/api/palettes/*`, `app/api/faces/*`, `app/api/projects/*`, `app/api/generate`, `app/api/edit`, `app/api/enhance-title`, `app/api/analyze-style`, `app/api/analyze-palette`, `app/api/generate-style-preview`, `app/api/storage/*`, `app/api/subscriptions/*`, `app/api/tiers`, `app/api/feedback`, `app/api/webhooks/stripe`, `app/api/notifications/*`, `app/api/favorites/*`, `app/api/experiments/*`, `app/api/account/export`, `app/api/account/delete`, `app/api/profiles/*`, `app/api/referrals/*`, `app/api/customer-portal`, `app/api/create-checkout`, `app/api/process-checkout`, `app/api/check-subscription`, `app/api/cron/cleanup-free-tier-thumbnails`, etc.

**Page/UI:** `OnboardingFlow`, `Providers`, `StudioPageContent`, `AuthForm`, `GoogleIcon`, `ResetPasswordForm`, `ForgotPasswordForm`, etc.

---

### 1.11 `middleware.ts`

| Function | Signature | Description |
|----------|-----------|-------------|
| `isProtectedRoute` | `(pathname: string) => boolean` | True if path matches protected routes. |
| `isAuthRoute` | `(pathname: string) => boolean` | True if path is auth route. |
| `isStudioRoute` | `(pathname: string) => boolean` | True if path is /studio or /studio/*. |
| `isOnboardingRoute` | `(pathname: string) => boolean` | True if path is /onboarding or /onboarding/*. |
| `middleware` | `(request: NextRequest) => Promise<NextResponse>` | Next.js middleware (auth, redirects). |

---

### 1.12 Scripts (`scripts/`)

Scripts are primarily `.js`/`.mjs`; they contain ad-hoc functions (e.g. `generate-pwa-icons.js`). Not enumerated in full here; no exported TS function API.

---

## 2. Identified Tool Candidates

The following functions are **suitable for conversion into agent tools** under the criteria:

- **Distinct, atomic operations**
- **Clear inputs and outputs**
- **No significant external context or state beyond explicit parameters**
- **Stateless or effectively stateless**

---

### 2.1 Parsing and time

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `parsePartToSeconds` | `(part: string) => number \| null` | Pure: string → number or null. No side effects, no global state. Ideal for an agent that needs to interpret timestamps (e.g. from video analytics). |
| `parseRangeToSeconds` | `(range: string) => [number, number] \| null` | Pure: range string → [start, end] or null. Same as above for ranges. |
| `getRepresentativeSecondsForCharacter` | `(character: CharacterWithScenes) => number \| null` | Pure: one representative second from character scenes. Useful for “pick a frame for this character.” |
| `getRepresentativeSecondsForPlace` | `(place: PlaceWithScenes) => number \| null` | Same for places. |

---

### 2.2 Date and analytics formatting

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `formatDateForAnalytics` | `(date: Date) => string` | Pure: Date → YYYY-MM-DD. Clear I/O, no state. |
| `getDateRangeForLastNDays` | `(days: number) => { startDate: string; endDate: string }` | Pure: N days → date range strings. Useful for “last 7 days” style queries. |

---

### 2.3 Face/pose and resolution helpers

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `getEmotionDescription` | `(emotion?: string) => string` | Pure: emotion key → prompt description. Good for building prompts. |
| `getPoseDescription` | `(pose?: string) => string` | Pure: pose key → prompt description. Same. |
| `getResolutionDimensions` | `(resolution: '1K' \| '2K' \| '4K', aspectRatio: string) => { width: number; height: number }` | Pure: resolution + aspect ratio → dimensions. Clear, stateless. |
| `getExpressionValues` | `() => string[]` | No args, deterministic list. Useful for “valid expressions” tool. |
| `getPoseValues` | `() => string[]` | Same for poses. |
| `formatExpressionsForPrompt` | `() => string` | Deterministic string for system prompts. |
| `formatPosesForPrompt` | `() => string` | Same for poses. |

---

### 2.4 Tier and credits (pure helpers)

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `getResolutionCost` | `(resolution: Resolution) => number` | Pure: resolution → credit cost. Stateless with fixed mapping. |
| `getGenerateCooldownMs` | `(tier: TierName) => number` | Pure: tier → cooldown ms. |
| `getRequiredTierForVariations` | `(variations: number) => TierName` | Pure: N variations → minimum tier. |
| `getRequiredTierForResolution` | `(resolution: Resolution) => TierName` | Pure: resolution → minimum tier. |
| `hasEnoughCredits` | `(creditsRemaining: number, resolution: Resolution) => boolean` | Pure: credits + resolution → boolean. |

---

### 2.5 Data transforms and lists

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `getCombinedThumbnailsList` | `(thumbnails: Thumbnail[], generatingItems: Map<string, Thumbnail>) => Thumbnail[]` | Pure: two inputs → single merged list. No I/O or global state. |
| `mapDbThumbnailToThumbnail` | `(db: DbThumbnail) => Thumbnail` | Pure mapper: DB shape → frontend shape. |
| `mapDbStyleToStyle` | `(db: DbStyle) => Style` | Same. |
| `mapDbPaletteToPalette` | `(db: DbPalette) => Palette` | Same. |
| `mapDbFaceToFace` | `(db: DbFace) => Face` | Same. |
| `mapPublicStyleToStyle` | `(publicStyle: PublicStyle) => Style` | Same for public view. |
| `mapPublicPaletteToPalette` | `(publicPalette: PublicPalette) => Palette` | Same. |

---

### 2.6 Storage and URL helpers

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `extractStoragePath` | `(url: string, bucket: BucketName) => string \| null` | Pure: signed URL + bucket → storage path or null. No side effects. |
| `getItemSafe` | `(key: string) => string \| null` | In browser context: key → value or null. Single atomic read; can be exposed as “read storage” tool. |
| `setItemWithCap` | `(key: string, payload: string, options?: SetItemWithCapOptions) => void` | In browser context: single atomic write with cap/trim. Can be “write storage” tool if agent has explicit key/payload. |

---

### 2.7 Error and response builders

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `unauthorizedResponse` | `(message?: string) => NextResponse` | Input: optional message. Output: 401 response. Stateless builder. |
| `notFoundResponse` | `(message?: string) => NextResponse` | Same for 404. |
| `validationErrorResponse` | `(message: string) => NextResponse` | Same for 400. |
| `forbiddenResponse` | `(message: string, details?: object) => NextResponse` | Same for 403. |
| `insufficientCreditsResponse` | `(creditsRemaining: number, required: number) => NextResponse` | Builds 403 with numeric payload. |

(Other error helpers in `lib/server/utils/error-handler.ts` follow the same pattern but take `error` or `context`; they can still be tool candidates if the agent is given sanitized inputs.)

---

### 2.8 Retry and image helpers

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `retryWithBackoff` | `(fetchFn: () => Promise<Response>, options?: RetryOptions) => Promise<Response>` | Clear contract: function + options → response. Stateless wrapper for idempotent fetch; good for “call API with retries” tool. |
| `blobToJpeg` | `(blob: Blob, quality?: number) => Promise<Blob>` | In client/browser context: blob → JPEG blob. Single transformation; can be “convert to JPEG” tool. |
| `clearUrlCache` | `() => void` | Single effect: clear in-memory URL cache. Can be “invalidate URL cache” tool when agent controls server request lifecycle. |

---

### 2.9 Sanitization and filtering

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `sanitizeErrorForClient` | `(error: unknown, context: string, defaultMessage: string) => string` | Deterministic given (error, context, defaultMessage). Good for “safe error message” tool. |
| `sanitizeApiErrorResponse` | `(errorText: string) => string` | Pure: string → sanitized string. |
| `filterAndSortResources` | `<T>(resources: T[], options: FilterSortOptions) => T[]` | Pure: list + options → filtered/sorted list. Generic, stateless. |

---

### 2.10 Middleware-style predicates

| Function | Signature | Rationale |
|----------|-----------|-----------|
| `isProtectedRoute` | `(pathname: string) => boolean` | Pure: pathname → boolean. Useful for routing/guard logic in an agent. |
| `isAuthRoute` | `(pathname: string) => boolean` | Same. |
| `isStudioRoute` | `(pathname: string) => boolean` | Same. |
| `isOnboardingRoute` | `(pathname: string) => boolean` | Same. |

---

## 3. Functions explicitly not recommended as agent tools (short rationale)

- **React hooks** (`use*`): Depend on React lifecycle and component state; not stateless.
- **API route handlers** (`GET`, `POST`, …): Require `Request`/`NextResponse`, auth, and server context; better exposed as HTTP APIs than as single-call tools.
- **Service layer** (`getThumbnails`, `createStyle`, etc.): Often require authenticated user/session and DB; “tool” would need explicit userId and possibly env; higher friction and auth surface. Can be revisited if the agent runs in a fully trusted server context with a fixed user.
- **Client-only UI** (e.g. `document`, `window`, `localStorage` without a small wrapper): Environment-specific; only `getItemSafe`/`setItemWithCap` are called out above as narrow, well-defined tools.
- **Logger / reportErrorToServer**: Side effects and environment (client vs server); not ideal as generic “tools” unless the agent is explicitly a logging/reporting actor.

---

## 4. Summary

- **Total functions scanned:** 400+ (excluding inline callbacks and non-exported helpers in scripts).
- **Tool candidates listed above:** 40+ functions across parsing, formatting, tier/credits, mappers, storage path, error builders, retry, sanitization, and route predicates.
- **Recommended next step:** Implement thin tool wrappers that call these functions with parameters provided by the agent (and, where needed, with fixed context such as `bucket` or `TierName`), and document inputs/outputs in the agent’s tool schema.
