/**
 * Database Types for Supabase
 * 
 * These types match the database schema defined in the migrations.
 * They provide type safety for all Supabase operations.
 */

// ============================================================================
// Core Types
// ============================================================================

/** Project share mode: all thumbnails or only favorites when shared. */
export type ShareMode = "all" | "favorites"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Project default settings (JSONB) – manual generator state saved per project.
 * All fields optional; new keys can be added without DB migration.
 */
export interface ProjectDefaultSettings {
  thumbnailText?: string
  customInstructions?: string
  includeStyles?: boolean
  selectedStyle?: string | null
  includePalettes?: boolean
  selectedPalette?: string | null
  selectedAspectRatio?: string
  selectedResolution?: string
  variations?: number
  includeStyleReferences?: boolean
  styleReferences?: string[]
  includeFaces?: boolean
  selectedFaces?: string[]
  faceExpression?: string
  facePose?: string
}

// ============================================================================
// Table Row Types (what you get when selecting)
// ============================================================================

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  is_admin: boolean
  onboarding_completed: boolean
}

/** Single roles table: user role assignment. No row = lowest tier (member). */
export interface Role {
  user_id: string
  role: string
  created_at: string
}

/** Resolved role name for auth/UI. No row in roles = 'member'. */
export type ResolvedRole = 'admin' | 'member'

export interface UserSubscription {
  id: string
  user_id: string
  status: string
  stripe_customer_id: string | null
  subscription_id: string | null
  product_id: string | null
  credits_total: number
  credits_remaining: number
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  description: string | null
  thumbnail_id: string | null
  created_at: string
}

export interface DbThumbnail {
  id: string
  user_id: string
  project_id?: string | null
  title: string
  image_url: string
  thumbnail_400w_url?: string | null // Optional - column may not exist yet
  thumbnail_800w_url?: string | null // Optional - column may not exist yet
  style: string | null
  palette: string | null
  emotion: string | null
  aspect_ratio: string | null
  resolution: string | null
  has_watermark: boolean
  liked: boolean
  is_public: boolean
  created_at: string
  like_count?: number // Favorite count (added by API)
  share_click_count?: number // Clicks when viewed via shared project gallery link
}

export interface DbProject {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  default_settings: ProjectDefaultSettings | null
}

/**
 * Minimal type for public thumbnails passed from Server to Client Components
 * Only includes fields actually used by PublicThumbnailsGallery to minimize serialization
 */
export interface PublicThumbnailData {
  id: string
  title: string
  image_url: string
  thumbnail_400w_url?: string | null
  thumbnail_800w_url?: string | null
  style: string | null
  palette: string | null
  liked: boolean
  created_at: string
  resolution: string | null
  share_click_count?: number
}

export interface DbStyle {
  id: string
  user_id: string | null
  name: string
  description: string | null
  prompt: string | null
  colors: string[]
  preview_thumbnail_url: string | null
  reference_images: string[]
  is_default: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface DbPalette {
  id: string
  user_id: string | null
  name: string
  colors: string[]
  is_default: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface DbFace {
  id: string
  user_id: string
  name: string
  image_urls: string[]
  created_at: string
  updated_at: string
}

export interface Favorite {
  id: string
  user_id: string
  item_id: string
  item_type: 'style' | 'palette' | 'thumbnail'
  created_at: string
}

export interface ReferralCode {
  id: string
  user_id: string
  code: string
  created_at: string
  updated_at: string
  is_active: boolean
  deactivated_at: string | null
  metadata: Json
}

export interface Referral {
  id: string
  referrer_user_id: string
  referred_user_id: string
  referral_code: string
  created_at: string
  status: 'pending' | 'qualified' | 'rewarded' | 'invalid'
  qualified_at: string | null
  rewarded_at: string | null
  reward_referrer_credits: number
  reward_referred_credits: number
  reward_idempotency_key: string | null
  metadata: Json
}

export interface UserPurchase {
  id: string
  user_id: string
  stripe_payment_intent_id: string
  amount_cents: number
  currency: string
  created_at: string
}

export interface StripeWebhookEvent {
  id: string
  event_id: string
  event_type: string
  processed_at: string
  data: Json
}

export interface Notification {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  type: string
  title: string
  body: string
  severity: 'info' | 'success' | 'warning' | 'error'
  icon: string | null
  action_url: string | null
  action_label: string | null
  metadata: Json
  is_read: boolean
  read_at: string | null
  is_archived: boolean
  archived_at: string | null
}

export interface NotificationPreferences {
  user_id: string
  created_at: string
  updated_at: string
  in_app_enabled: boolean
  types_enabled: Json
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

/** Legacy category type; prefer FeedbackTableCategory for the feedback table. */
export type FeedbackCategory = 'general' | 'bug_report' | 'feature_request' | 'billing' | 'account' | 'performance' | 'other'
/** Status values for the feedback table (workflow). */
export type FeedbackStatus = 'New' | 'Pending' | 'Triage' | 'Resolved'
export type FeedbackSeverity = 'low' | 'normal' | 'high' | 'urgent'

/** Category values for the feedback table (API submissions). */
export type FeedbackTableCategory = 'bug' | 'feature request' | 'other' | 'just a message'

/** Row shape for the feedback table (secure submission endpoint). */
export interface Feedback {
  id: string
  email: string | null
  status: FeedbackStatus
  category: FeedbackTableCategory
  message: string
  page_url: string | null
  user_agent: string | null
  app_version: string | null
  created_at: string
  metadata: Json
}

// ============================================================================
// Insert Types (what you provide when inserting)
// ============================================================================

export interface ProfileInsert {
  id: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  created_at?: string
  is_admin?: boolean
  onboarding_completed?: boolean
}

export interface RoleInsert {
  user_id: string
  role: string
  created_at?: string
}

export interface UserSubscriptionInsert {
  id?: string
  user_id: string
  status?: string
  stripe_customer_id?: string | null
  subscription_id?: string | null
  product_id?: string | null
  credits_total?: number
  credits_remaining?: number
  current_period_start?: string | null
  current_period_end?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreditTransactionInsert {
  id?: string
  user_id: string
  amount: number
  type: string
  description?: string | null
  thumbnail_id?: string | null
  metadata?: Json
  created_at?: string
}

export interface ReferralCodeInsert {
  id?: string
  user_id: string
  code: string
  created_at?: string
  updated_at?: string
  is_active?: boolean
  deactivated_at?: string | null
  metadata?: Json
}

export interface ReferralInsert {
  id?: string
  referrer_user_id: string
  referred_user_id: string
  referral_code: string
  created_at?: string
  status?: 'pending' | 'qualified' | 'rewarded' | 'invalid'
  qualified_at?: string | null
  rewarded_at?: string | null
  reward_referrer_credits?: number
  reward_referred_credits?: number
  reward_idempotency_key?: string | null
  metadata?: Json
}

export interface UserPurchaseInsert {
  id?: string
  user_id: string
  stripe_payment_intent_id: string
  amount_cents: number
  currency?: string
  created_at?: string
}

export interface ThumbnailInsert {
  id?: string
  user_id: string
  project_id?: string | null
  title: string
  image_url: string
  style?: string | null
  palette?: string | null
  emotion?: string | null
  aspect_ratio?: string | null
  resolution?: string | null
  has_watermark?: boolean
  liked?: boolean
  created_at?: string
}

export interface ProjectInsert {
  id?: string
  user_id: string
  name: string
  created_at?: string
  updated_at?: string
  default_settings?: ProjectDefaultSettings | null
}

export interface ProjectUpdate {
  name?: string
  updated_at?: string
  default_settings?: ProjectDefaultSettings | null
  share_slug?: string | null
  share_mode?: ShareMode | null
}

export interface StyleInsert {
  id?: string
  user_id?: string | null
  name: string
  description?: string | null
  prompt?: string | null
  colors?: string[]
  preview_thumbnail_url?: string | null
  reference_images?: string[]
  is_default?: boolean
  is_public?: boolean
  created_at?: string
  updated_at?: string
}

export interface PaletteInsert {
  id?: string
  user_id?: string | null
  name: string
  colors: string[]
  is_default?: boolean
  is_public?: boolean
  created_at?: string
  updated_at?: string
}

export interface FaceInsert {
  id?: string
  user_id: string
  name: string
  image_urls?: string[]
  created_at?: string
  updated_at?: string
}

export interface FavoriteInsert {
  id?: string
  user_id: string
  item_id: string
  item_type: 'style' | 'palette' | 'thumbnail'
  created_at?: string
}

export interface NotificationInsert {
  id?: string
  user_id: string
  created_at?: string
  updated_at?: string
  type: string
  title: string
  body: string
  severity?: 'info' | 'success' | 'warning' | 'error'
  icon?: string | null
  action_url?: string | null
  action_label?: string | null
  metadata?: Json
  is_read?: boolean
  read_at?: string | null
  is_archived?: boolean
  archived_at?: string | null
}

export interface NotificationPreferencesInsert {
  user_id: string
  created_at?: string
  updated_at?: string
  in_app_enabled?: boolean
  types_enabled?: Json
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
}

/** Insert shape for the feedback table (API only inserts; no updates from client). */
export interface FeedbackInsert {
  id?: string
  email?: string | null
  status?: FeedbackStatus
  category: FeedbackTableCategory
  message: string
  page_url?: string | null
  user_agent?: string | null
  app_version?: string | null
  created_at?: string
  metadata?: Json
}

// ============================================================================
// Update Types (what you provide when updating)
// ============================================================================

export interface ProfileUpdate {
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  is_admin?: boolean
  onboarding_completed?: boolean
}

export interface UserSubscriptionUpdate {
  status?: string
  stripe_customer_id?: string | null
  subscription_id?: string | null
  product_id?: string | null
  credits_total?: number
  credits_remaining?: number
  current_period_start?: string | null
  current_period_end?: string | null
  updated_at?: string
}

export interface ThumbnailUpdate {
  title?: string
  image_url?: string
  style?: string | null
  palette?: string | null
  emotion?: string | null
  aspect_ratio?: string | null
  has_watermark?: boolean
  liked?: boolean
  project_id?: string | null
}

export interface StyleUpdate {
  name?: string
  description?: string | null
  prompt?: string | null
  colors?: string[]
  preview_thumbnail_url?: string | null
  reference_images?: string[]
  is_public?: boolean
  updated_at?: string
}

export interface PaletteUpdate {
  name?: string
  colors?: string[]
  is_public?: boolean
  updated_at?: string
}

export interface FaceUpdate {
  name?: string
  image_urls?: string[]
  updated_at?: string
}

export interface ReferralCodeUpdate {
  code?: string
  is_active?: boolean
  deactivated_at?: string | null
  metadata?: Json
  updated_at?: string
}

export interface ReferralUpdate {
  status?: 'pending' | 'qualified' | 'rewarded' | 'invalid'
  qualified_at?: string | null
  rewarded_at?: string | null
  reward_referrer_credits?: number
  reward_referred_credits?: number
  reward_idempotency_key?: string | null
  metadata?: Json
}

export interface NotificationUpdate {
  is_read?: boolean
  read_at?: string | null
  is_archived?: boolean
  archived_at?: string | null
  updated_at?: string
}

export interface NotificationPreferencesUpdate {
  in_app_enabled?: boolean
  types_enabled?: Json
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  updated_at?: string
}

/** Admin-only updates (e.g. status); API route does not perform updates. */
export interface FeedbackUpdate {
  status?: FeedbackStatus
}

// ============================================================================
// YouTube Integration Types
// ============================================================================

export interface DbYouTubeIntegration {
  id: string
  user_id: string
  google_user_id: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string
  scopes_granted: string[]
  is_connected: boolean
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface DbYouTubeChannel {
  id: string
  user_id: string
  channel_id: string
  title: string | null
  description: string | null
  custom_url: string | null
  thumbnail_url: string | null
  subscriber_count: number | null
  video_count: number | null
  view_count: number | null
  published_at: string | null
  country: string | null
  fetched_at: string
  created_at: string
  updated_at: string
}

export interface DbYouTubeAnalytics {
  id: string
  user_id: string
  channel_id: string
  date_range_start: string
  date_range_end: string
  views: number
  watch_time_minutes: number
  average_view_duration_seconds: number
  likes: number
  dislikes: number
  comments: number
  shares: number
  subscribers_gained: number
  subscribers_lost: number
  estimated_revenue: number | null
  traffic_sources: Json
  demographics: Json
  fetched_at: string
  created_at: string
}

export interface YouTubeIntegrationInsert {
  id?: string
  user_id: string
  google_user_id?: string | null
  access_token: string
  refresh_token?: string | null
  expires_at: string
  scopes_granted?: string[]
  is_connected?: boolean
  revoked_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface YouTubeIntegrationUpdate {
  google_user_id?: string | null
  access_token?: string
  refresh_token?: string | null
  expires_at?: string
  scopes_granted?: string[]
  is_connected?: boolean
  revoked_at?: string | null
  updated_at?: string
}

export interface YouTubeChannelInsert {
  id?: string
  user_id: string
  channel_id: string
  title?: string | null
  description?: string | null
  custom_url?: string | null
  thumbnail_url?: string | null
  subscriber_count?: number | null
  video_count?: number | null
  view_count?: number | null
  published_at?: string | null
  country?: string | null
  fetched_at?: string
  created_at?: string
  updated_at?: string
}

export interface YouTubeChannelUpdate {
  channel_id?: string
  title?: string | null
  description?: string | null
  custom_url?: string | null
  thumbnail_url?: string | null
  subscriber_count?: number | null
  video_count?: number | null
  view_count?: number | null
  published_at?: string | null
  country?: string | null
  fetched_at?: string
  updated_at?: string
}

export interface YouTubeAnalyticsInsert {
  id?: string
  user_id: string
  channel_id: string
  date_range_start: string
  date_range_end: string
  views?: number
  watch_time_minutes?: number
  average_view_duration_seconds?: number
  likes?: number
  dislikes?: number
  comments?: number
  shares?: number
  subscribers_gained?: number
  subscribers_lost?: number
  estimated_revenue?: number | null
  traffic_sources?: Json
  demographics?: Json
  fetched_at?: string
  created_at?: string
}

// Note: YouTubeAnalytics is typically upserted, not updated individually

export interface SubscriptionTierInsert {
  id?: string
  tier_name: string
  name: string
  product_id?: string | null
  price_id?: string | null
  credits_per_month: number
  allowed_resolutions?: string[]
  has_watermark?: boolean
  has_enhance?: boolean
  persistent_storage?: boolean
  storage_retention_days?: number | null
  priority_generation?: boolean
  early_access?: boolean
  price?: number
  max_variations?: number
  can_create_custom?: boolean
  display_order?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface SubscriptionTierUpdate {
  tier_name?: string
  name?: string
  test_product_id?: string | null
  test_price_id?: string | null
  live_product_id?: string | null
  live_price_id?: string | null
  credits_per_month?: number
  allowed_resolutions?: string[]
  has_watermark?: boolean
  has_enhance?: boolean
  persistent_storage?: boolean
  storage_retention_days?: number | null
  priority_generation?: boolean
  early_access?: boolean
  price?: number
  max_variations?: number
  can_create_custom?: boolean
  display_order?: number
  is_active?: boolean
  updated_at?: string
}

export interface SubscriptionSettingInsert {
  key: string
  value: string
  updated_at?: string
}

export interface SubscriptionSettingUpdate {
  value?: string
  updated_at?: string
}

// ============================================================================
// View Types (public views without user_id)
// ============================================================================

export interface PublicStyle {
  id: string
  name: string
  description: string | null
  preview_thumbnail_url: string | null
  like_count?: number // Favorite count (added by API)
}

export interface PublicPalette {
  id: string
  name: string
  colors: string[]
  is_public: boolean
  is_default: boolean
  created_at: string
  updated_at: string
  like_count?: number // Favorite count (added by API)
}

export interface SubscriptionTier {
  id: string
  tier_name: string
  name: string
  test_product_id: string | null
  test_price_id: string | null
  live_product_id: string | null
  live_price_id: string | null
  credits_per_month: number
  allowed_resolutions: string[]
  has_watermark: boolean
  has_enhance: boolean
  persistent_storage: boolean
  storage_retention_days: number | null
  priority_generation: boolean
  early_access: boolean
  price: number
  max_variations: number
  can_create_custom: boolean
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SubscriptionSetting {
  key: string
  value: string
  updated_at: string
}

// ============================================================================
// Database Schema Type (for Supabase client)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      roles: {
        Row: Role
        Insert: RoleInsert
        Update: { role?: string; created_at?: string }
      }
      user_subscriptions: {
        Row: UserSubscription
        Insert: UserSubscriptionInsert
        Update: UserSubscriptionUpdate
      }
      credit_transactions: {
        Row: CreditTransaction
        Insert: CreditTransactionInsert
        Update: never // Immutable audit log
      }
      thumbnails: {
        Row: DbThumbnail
        Insert: ThumbnailInsert
        Update: ThumbnailUpdate
      }
      styles: {
        Row: DbStyle
        Insert: StyleInsert
        Update: StyleUpdate
      }
      palettes: {
        Row: DbPalette
        Insert: PaletteInsert
        Update: PaletteUpdate
      }
      faces: {
        Row: DbFace
        Insert: FaceInsert
        Update: FaceUpdate
      }
      favorites: {
        Row: Favorite
        Insert: FavoriteInsert
        Update: never // Favorites are created/deleted only
      }
      referral_codes: {
        Row: ReferralCode
        Insert: ReferralCodeInsert
        Update: ReferralCodeUpdate
      }
      referrals: {
        Row: Referral
        Insert: ReferralInsert
        Update: ReferralUpdate
      }
      user_purchases: {
        Row: UserPurchase
        Insert: UserPurchaseInsert
        Update: never // Immutable purchase log
      }
      notifications: {
        Row: Notification
        Insert: NotificationInsert
        Update: NotificationUpdate
      }
      notification_preferences: {
        Row: NotificationPreferences
        Insert: NotificationPreferencesInsert
        Update: NotificationPreferencesUpdate
      }
      feedback: {
        Row: Feedback
        Insert: FeedbackInsert
        Update: FeedbackUpdate
      }
      youtube_integrations: {
        Row: DbYouTubeIntegration
        Insert: YouTubeIntegrationInsert
        Update: YouTubeIntegrationUpdate
      }
      youtube_channels: {
        Row: DbYouTubeChannel
        Insert: YouTubeChannelInsert
        Update: YouTubeChannelUpdate
      }
      youtube_analytics: {
        Row: DbYouTubeAnalytics
        Insert: YouTubeAnalyticsInsert
        Update: never // Upserted only
      }
      subscription_tiers: {
        Row: SubscriptionTier
        Insert: SubscriptionTierInsert
        Update: SubscriptionTierUpdate
      }
      subscription_settings: {
        Row: SubscriptionSetting
        Insert: SubscriptionSettingInsert
        Update: SubscriptionSettingUpdate
      }
    }
    Views: {
      public_styles: {
        Row: PublicStyle
      }
      public_palettes: {
        Row: PublicPalette
      }
      youtube_integration_status: {
        Row: {
          user_id: string
          google_user_id: string | null
          is_connected: boolean
          scopes_granted: string[]
          created_at: string
          updated_at: string
          revoked_at: string | null
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ============================================================================
// Frontend-Friendly Types (mapped from DB types)
// These match the existing component interfaces
// ============================================================================

/**
 * Thumbnail type for frontend components
 * Maps from DbThumbnail with frontend-friendly field names
 */
export interface Thumbnail {
  id: string
  name: string           // maps to title
  imageUrl: string       // maps to image_url
  thumbnail400wUrl: string | null // maps to thumbnail_400w_url
  thumbnail800wUrl: string | null // maps to thumbnail_800w_url
  prompt: string         // derived from style/palette/emotion
  isFavorite: boolean    // maps to liked
  isPublic: boolean      // derived from favorites or sharing
  createdAt: Date        // maps to created_at
  generating?: boolean   // UI state only
  /** Failed-generation UI state (client-only; for items in generatingItems) */
  error?: string
  likeCount?: number     // from favorites count
  authorId?: string      // maps to user_id
  authorName?: string    // from profiles join
  resolution?: string | null // maps to resolution (1K, 2K, 4K)
  projectId?: string | null // maps to project_id
  /** Clicks when viewed via shared project gallery (approval score) */
  shareClickCount?: number
}

/**
 * Style type for frontend components
 * Maps from DbStyle with frontend-friendly field names
 */
export interface Style {
  id: string
  name: string
  description: string
  prompt: string
  referenceImage: string   // first of reference_images[]
  previewImage: string     // maps to preview_thumbnail_url
  createdAt: Date
  isPublic?: boolean
  isFavorite?: boolean
  likeCount?: number
  authorId?: string
  authorName?: string
}

/**
 * Palette type for frontend components
 * Maps from DbPalette with frontend-friendly field names
 */
export interface Palette {
  id: string
  name: string
  description: string      // can be empty for palettes
  colors: string[]
  referenceImage: string | null
  createdAt: Date
  isPublic?: boolean
  isFavorite?: boolean
  likeCount?: number
  authorId?: string
  authorName?: string
}

/**
 * Face type for frontend components
 * Maps from DbFace with frontend-friendly field names
 */
export interface Face {
  id: string
  name: string
  referenceImages: string[]  // maps to image_urls
  createdAt: Date
}

// ============================================================================
// Utility Mappers
// ============================================================================

/**
 * Convert database thumbnail to frontend thumbnail
 */
export function mapDbThumbnailToThumbnail(db: DbThumbnail): Thumbnail {
  return {
    id: db.id,
    name: db.title,
    imageUrl: db.image_url,
    thumbnail400wUrl: db.thumbnail_400w_url ?? null,
    thumbnail800wUrl: db.thumbnail_800w_url ?? null,
    prompt: [db.style, db.palette, db.emotion].filter(Boolean).join(' | ') || '',
    isFavorite: db.liked,
    isPublic: db.is_public || false,
    createdAt: new Date(db.created_at),
    authorId: db.user_id,
    resolution: db.resolution || undefined,
    likeCount: db.like_count || 0,
    projectId: db.project_id ?? null,
    shareClickCount: db.share_click_count ?? 0,
  }
}

/**
 * Convert database style to frontend style
 */
export function mapDbStyleToStyle(db: DbStyle): Style {
  return {
    id: db.id,
    name: db.name,
    description: db.description || '',
    prompt: db.prompt || '',
    referenceImage: db.reference_images[0] || '',
    previewImage: db.preview_thumbnail_url || '',
    createdAt: new Date(db.created_at),
    isPublic: db.is_public,
    authorId: db.user_id || undefined,
  }
}

/**
 * Convert database palette to frontend palette
 */
export function mapDbPaletteToPalette(db: DbPalette): Palette {
  return {
    id: db.id,
    name: db.name,
    description: '',
    colors: db.colors,
    referenceImage: null,
    createdAt: new Date(db.created_at),
    isPublic: db.is_public,
    authorId: db.user_id || undefined,
  }
}

/**
 * Convert database face to frontend face
 */
export function mapDbFaceToFace(db: DbFace): Face {
  return {
    id: db.id,
    name: db.name,
    referenceImages: db.image_urls,
    createdAt: new Date(db.created_at),
  }
}

/**
 * Convert public style (from view) to frontend style
 * Note: PublicStyle view only exposes public fields (id, name, description, preview_thumbnail_url)
 */
export function mapPublicStyleToStyle(publicStyle: PublicStyle): Style {
  return {
    id: publicStyle.id,
    name: publicStyle.name,
    description: publicStyle.description || '',
    prompt: '', // Not available in public view for security
    referenceImage: '', // Not available in public view for security
    previewImage: publicStyle.preview_thumbnail_url || '',
    createdAt: new Date(), // Not available in public view
    isPublic: true, // All styles in public_styles view are public
    authorId: undefined, // Public styles don't expose user_id
    likeCount: publicStyle.like_count,
  }
}

/**
 * Convert public palette (from view) to frontend palette
 */
export function mapPublicPaletteToPalette(publicPalette: PublicPalette): Palette {
  return {
    id: publicPalette.id,
    name: publicPalette.name,
    description: '',
    colors: publicPalette.colors,
    referenceImage: null,
    createdAt: new Date(publicPalette.created_at),
    isPublic: publicPalette.is_public,
    authorId: undefined, // Public palettes don't expose user_id
    likeCount: publicPalette.like_count,
  }
}