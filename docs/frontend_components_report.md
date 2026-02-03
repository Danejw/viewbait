# Frontend Components Report

Generated inventory of front-end components in the Viewbait application.  
Framework: **React** (Next.js). File types: **`.tsx`** only.

---

## 1. App (Pages & Layout)

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| RootLayout | `app/layout.tsx` | `{ children }` (Next.js layout) | Root layout; exports `metadata`, `viewport`. |
| ViewBaitLanding | `app/page.tsx` | (default export) | Landing page. |
| AuthPage | `app/auth/page.tsx` | (default export) | Auth/sign-in page. |
| AuthForm | `app/auth/page.tsx` | — | Internal form component on auth page. |
| ResetPasswordPage | `app/auth/reset-password/page.tsx` | (default export) | Password reset page. |
| ForgotPasswordPage | `app/auth/forgot-password/page.tsx` | (default export) | Forgot-password page. |
| StudioPage | `app/studio/page.tsx` | (default export) | Studio app page. |
| StudioPageContent | `app/studio/page.tsx` | — | Internal studio page content. |
| SharedProjectGalleryPage | `app/p/[slug]/page.tsx` | (default export) | Public shared project gallery by slug. |
| TermsPage | `app/legal/terms/page.tsx` | (default export) | Terms of service page. |
| PrivacyPage | `app/legal/privacy/page.tsx` | (default export) | Privacy policy page. |
| NotFound | `app/not-found.tsx` | (default export) | 404 not-found page. |
| OnboardingPage | `app/onboarding/page.tsx` | (default export) | Onboarding flow page. |
| Providers | `app/providers.tsx` | `children: ReactNode` | App-wide providers wrapper. |

---

## 2. Lib (Contexts & Providers)

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| OnboardingProvider | `lib/contexts/onboarding-context.tsx` | `children`, `isOnboarding?` | Onboarding context provider. |
| AuthProvider | `lib/hooks/useAuth.tsx` | `children`, `initialUser?` | Auth context provider. |
| SubscriptionProvider | `lib/hooks/useSubscription.tsx` | `children` | Subscription/credits context provider. |
| QueryProvider | `lib/providers/QueryProvider.tsx` | `children: React.ReactNode` | React Query provider. |

---

## 3. Components (Root Level)

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| AccountSettingsModal | `components/account-settings-modal.tsx` | `isOpen`, `onClose` | Account settings modal (default export). |
| FeedbackModal | `components/feedback-modal.tsx` | `open`, `onClose` (FeedbackModalProps) | User feedback submission modal. |
| PwaRegister | `components/pwa-register.tsx` | — | PWA registration / service worker registration. |
| ReferralModal | `components/referral-modal.tsx` | `isOpen`, `onClose` | Referral program modal (default export). |
| SubscriptionModal | `components/subscription-modal.tsx` | `isOpen`, `onClose`, `currentTier` | Subscription/upgrade modal (default export). |
| StudioLoading | `components/loading.tsx` | (default export) | Loading state for studio. |
| ThemeProvider | `components/theme-provider.tsx` | `children`, ...ThemeProviderProps (next-themes) | Theme (light/dark) provider. |
| ThemeToggle | `components/theme-toggle.tsx` | `showTooltip?`, `size?`, etc. (ThemeToggleProps) | Theme toggle with optional tooltip. |
| ThemeToggleSimple | `components/theme-toggle.tsx` | `showTooltip?`, `size?` (ThemeToggleSimpleProps) | Simplified theme toggle. |
| ComponentExample | `components/component-example.tsx` | — | Example/demo component. |
| GalleryIcon | `components/GalleryIcon.tsx` | `startColor?`, `endColor?`, etc. (GalleryIconProps) | Gallery icon with gradient. |
| SearchIcon | `components/SearchIcon.tsx` | — | Search icon component. |

---

## 4. Components — Landing

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| LandingNav | `components/landing/landing-nav.tsx` | `setCursorVariant?` (LandingNavProps) | Landing navigation; optional cursor variant on hover. |
| LandingFooter | `components/landing/landing-footer.tsx` | `onLinkMouseEnter?`, `onLinkMouseLeave?` (LandingFooterProps) | Footer with optional link hover callbacks. |
| LegalPageView | `components/landing/legal-page-view.tsx` | `title`, `content` (LegalPageViewProps) | Renders legal page title and markdown content. |
| LenisRoot | `components/landing/lenis-root.tsx` | `children: ReactNode \| ((scrollY: number) => ReactNode)` (LenisRootProps) | Lenis smooth-scroll root; children can receive scrollY. |
| PublicBetaBanner | `components/landing/public-beta-banner.tsx` | — | “Now in Public Beta” banner. |
| ScrollReveal | `components/landing/scroll-reveal.tsx` | `children`, `offsetY?` (ScrollRevealProps) | Scroll-triggered reveal with optional vertical offset. |
| VHSScrollReveal | `components/landing/vhs-scroll-reveal.tsx` | `enabled?`, `repeatPerViewport?`, `children`, etc. (VHSScrollRevealProps) | VHS-style scroll reveal overlay. |

---

## 5. Components — Studio

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| ActionBarIcon | `components/studio/action-bar-icon.tsx` | `children`, `className?`, ...HTMLAttributes (forwardRef) | Shared icon wrapper for card action bars; hover scale/lift. |
| BrowseControls | `components/studio/browse-controls.tsx` | `searchQuery`, `onSearchChange`, `filter?`, `onFilterChange?`, etc. (BrowseControlsProps) | Search/filter controls for browse views. |
| BrowsePalettes | `components/studio/browse-palettes.tsx` | `onPaletteClick?`, `onUsePalette?` (BrowsePalettesProps) | Browse palettes grid/list. |
| BrowseStyles | `components/studio/browse-styles.tsx` | `onStyleClick?`, `onUseStyle?` (BrowseStylesProps) | Browse styles grid/list. |
| BrowseThumbnails | `components/studio/browse-thumbnails.tsx` | — | Browse thumbnails view. |
| ChannelImportTab | `components/studio/channel-import-tab.tsx` | `onStyleCreated?` (ChannelImportTabProps) | YouTube channel import tab; optional style-created callback. |
| CharacterSnapshotsStrip | `components/studio/character-snapshots-strip.tsx` | — | Strip of character snapshots. |
| ChatMessage | `components/studio/chat-message.tsx` | `role`, `content`, `timestamp?`, `attachedImages?` (ChatMessageProps) | Single chat message (user/assistant). |
| DeleteConfirmationModal | `components/studio/delete-confirmation-modal.tsx` | `open`, `onOpenChange`, `thumbnail` (DeleteConfirmationModalProps) | Confirm thumbnail deletion. |
| DragOverlayPreview | `components/studio/drag-overlay-preview.tsx` | `type`, `item`, `imageUrl?` (DragOverlayPreviewProps) | Drag overlay preview for styles, palettes, faces, thumbnails, snapshots. |
| DynamicUIRenderer | `components/studio/dynamic-ui-renderer.tsx` | `components: UIComponentName[]` (DynamicUIRendererProps) | Renders dynamic UI components by name. |
| FaceCard | `components/studio/face-card.tsx` | `face`, `isSelected?`, `onSelect?` (FaceCardProps) | Face card. |
| FaceCardCompact | `components/studio/face-card.tsx` | (FaceCardProps) | Compact face card variant. |
| FaceCardSkeleton | `components/studio/face-card.tsx` | `compact?` | Skeleton for face card. |
| FaceEditor | `components/studio/face-editor.tsx` | `open`, `onOpenChange`, `face?` (FaceEditorProps) | Create/edit face modal. |
| FaceThumbnail | `components/studio/face-thumbnail.tsx` | `face`, `currentUserId?` (FaceThumbnailProps) | Face thumbnail with actions. |
| FaceThumbnailSkeleton | `components/studio/face-thumbnail.tsx` | `compact?` | Skeleton for face thumbnail. |
| GalleryControls | `components/studio/gallery-controls.tsx` | `orderBy`, `orderDirection`, `onSortChange`, etc. (GalleryControlsProps) | Gallery sort/filter controls. |
| PaletteCard | `components/studio/palette-card.tsx` | `palette`, `onUsePalette?`, `onClick?` (PaletteCardProps) | Palette card. |
| PaletteCardCompact | `components/studio/palette-card-manage.tsx` | (PaletteCardManageProps) | Compact palette card in manage view. |
| PaletteCardEmpty | `components/studio/palette-card.tsx` | — | Empty palette card placeholder. |
| PaletteCardManage | `components/studio/palette-card-manage.tsx` | `palette`, `isSelected?`, `isFavorite?` (PaletteCardManageProps) | Palette card in manage/select context. |
| PaletteCardManageSkeleton | `components/studio/palette-card-manage.tsx` | — | Skeleton for palette card manage. |
| PaletteCardSkeleton | `components/studio/palette-card.tsx` | — | Skeleton for palette card. |
| PaletteColorStrip | `components/studio/palette-thumbnail-card.tsx` | `colors`, etc. | Color strip for palette. |
| PaletteEditor | `components/studio/palette-editor.tsx` | `open`, `onOpenChange`, `palette?` (PaletteEditorProps) | Create/edit palette modal. |
| PaletteGrid | `components/studio/palette-grid.tsx` | `palettes`, `currentUserId?`, `minSlots?`, `showEmptySlots?` (PaletteGridProps) | Grid of palette cards. |
| PaletteGridSkeleton | `components/studio/palette-grid.tsx` | `count?` | Skeleton for palette grid. |
| PaletteThumbnailCard | `components/studio/palette-thumbnail-card.tsx` | `palette`, `currentUserId?`, etc. (PaletteThumbnailCardProps) | Palette thumbnail card with actions. |
| PlaceSnapshotsStrip | `components/studio/place-snapshots-strip.tsx` | — | Strip of place snapshots. |
| ProcessCheckoutOnReturn | `components/studio/process-checkout-return.tsx` | — | Handles return from checkout (e.g. Stripe). |
| ProjectCard | `components/studio/project-card.tsx` | `project`, `isActive?`, etc. (ProjectCardProps) | Project card. |
| ProjectCardSkeleton | `components/studio/project-card.tsx` | — | Skeleton for project card. |
| ProjectSelector | `components/studio/project-selector.tsx` | `variant?`, `label?`, etc. (ProjectSelectorProps) | Project dropdown/selector. |
| RecentThumbnailsStrip | `components/studio/recent-thumbnails-strip.tsx` | — | Strip of recent thumbnails. |
| ShareProjectDialog | `components/studio/share-project-dialog.tsx` | `project`, `open`, `onOpenChange` (ShareProjectDialogProps) | Share project dialog. |
| SharedGalleryCard | `components/studio/shared-gallery-card.tsx` | `thumbnail`, `onClick?` (SharedGalleryCardProps) | Public gallery thumbnail card. |
| SharedGalleryCardSkeleton | `components/studio/shared-gallery-card.tsx` | — | Skeleton for shared gallery card. |
| SnapshotViewModal | `components/studio/snapshot-view-modal.tsx` | `open`, `onOpenChange`, `snapshot` (SnapshotViewModalProps) | View snapshot in modal. |
| StudioChatPanel | `components/studio/studio-chat.tsx` | — | In-sidebar chat for thumbnail creation; messages, suggestions, persistence. |
| StudioChatAssistant | `components/studio/studio-chat.tsx` | — | Floating chat assistant (legacy). |
| StudioChatToggle | `components/studio/studio-chat.tsx` | — | Button to open floating chat. |
| StudioDndContext | `components/studio/studio-dnd-context.tsx` | `children` (StudioDndContextProps) | Drag-and-drop context for studio. |
| StudioFrame | `components/studio/studio-frame.tsx` | `children?` | Studio frame wrapper. |
| StudioHeader (frame) | `components/studio/studio-frame.tsx` | `children?` | Studio header slot in frame. |
| StudioGenerator | `components/studio/studio-generator.tsx` | — | Main generator form/panel. |
| StudioGeneratorAspectRatio | `components/studio/studio-generator.tsx` | — | Aspect ratio control. |
| StudioGeneratorAspectAndResolution | `components/studio/studio-generator.tsx` | — | Combined aspect ratio and resolution. |
| StudioGeneratorChat | `components/studio/studio-generator.tsx` | — | Chat section in generator. |
| StudioGeneratorCustomInstructions | `components/studio/studio-generator.tsx` | — | Custom instructions field. |
| StudioGeneratorFaces | `components/studio/studio-generator.tsx` | — | Face selection in generator. |
| StudioGeneratorPalette | `components/studio/studio-generator.tsx` | — | Palette selection in generator. |
| StudioGeneratorResolution | `components/studio/studio-generator.tsx` | — | Resolution control. |
| StudioGeneratorStyleReferences | `components/studio/studio-generator.tsx` | — | Style reference images. |
| StudioGeneratorStyleSelection | `components/studio/studio-generator.tsx` | — | Style picker in generator. |
| StudioGeneratorSubmit | `components/studio/studio-generator.tsx` | `className?`, `label?`, etc. (StudioGeneratorSubmitProps) | Submit button for generation. |
| StudioGeneratorTabs | `components/studio/studio-generator.tsx` | — | Tabs in generator. |
| StudioGeneratorThumbnailText | `components/studio/studio-generator.tsx` | — | Thumbnail text input. |
| StudioGeneratorVariations | `components/studio/studio-generator.tsx` | — | Number of variations control. |
| StudioHeader | `components/studio/studio-header.tsx` | — | Studio header composition (brand, title, credits, user). |
| StudioHeaderBrand | `components/studio/studio-header.tsx` | — | Logo/brand in header. |
| StudioHeaderCredits | `components/studio/studio-header.tsx` | `className?` | Credits display in header. |
| StudioHeaderTitle | `components/studio/studio-header.tsx` | `title` | Page title in header. |
| StudioHeaderUser | `components/studio/studio-header.tsx` | — | User menu in header. |
| StudioLayout | `components/studio/studio-frame.tsx` | `children` | Studio layout wrapper. |
| StudioLayoutResponsive | `components/studio/studio-frame.tsx` | `sidebar`, `main`, etc. | Responsive studio layout (sidebar + main). |
| StudioMainContent | `components/studio/studio-views.tsx` | — | Main content area (view switcher). |
| StudioMainPanel | `components/studio/studio-frame.tsx` | `children` | Main content panel. |
| StudioMobileFloatingNav | `components/studio/studio-mobile-floating-nav.tsx` | — | Mobile floating navigation. |
| StudioProvider | `components/studio/studio-provider.tsx` | `children` | Studio state/actions provider. |
| StudioProjectSwitcher | `components/studio/studio-project-switcher.tsx` | — | Project switcher UI. |
| StudioResults | `components/studio/studio-results.tsx` | — | Results section container. |
| StudioResultsError | `components/studio/studio-results.tsx` | — | Error state for results. |
| StudioResultsGrid | `components/studio/studio-results.tsx` | — | Grid of result thumbnails. |
| StudioResultsHeader | `components/studio/studio-results.tsx` | — | Results header. |
| StudioResultsLoadMore | `components/studio/studio-results.tsx` | — | Load more button. |
| StudioSettingsPanel | `components/studio/studio-frame.tsx` | `children` | Settings panel. |
| StudioSettingsSidebar | `components/studio/studio-settings-sidebar.tsx` | — | Settings sidebar. |
| StudioSettingsSidebarCollapsed | `components/studio/studio-settings-sidebar.tsx` | — | Collapsed settings sidebar. |
| StudioSettingsSidebarContent | `components/studio/studio-settings-sidebar.tsx` | — | Settings sidebar content. |
| StudioSettingsSidebarHeader | `components/studio/studio-settings-sidebar.tsx` | — | Settings sidebar header. |
| StudioSidebar | `components/studio/studio-frame.tsx` | `children` | Sidebar slot in frame. |
| StudioSidebar | `components/studio/studio-sidebar.tsx` | `onCloseRequested?` | Full sidebar (nav, credits, user). |
| StudioSidebarCredits | `components/studio/studio-sidebar.tsx` | — | Credits in sidebar. |
| StudioSidebarNav | `components/studio/studio-sidebar.tsx` | — | Sidebar navigation. |
| StudioSidebarToggle | `components/studio/studio-sidebar.tsx` | — | Collapse/expand sidebar button. |
| StudioSidebarUser | `components/studio/studio-sidebar.tsx` | — | User block in sidebar. |
| StudioResultsPanel | `components/studio/studio-frame.tsx` | `children` | Results panel slot. |
| StudioView | `components/studio/studio-views.tsx` | — | Top-level studio view (gallery, browse, styles, etc.). |
| StudioViewBrowse | `components/studio/studio-views.tsx` | — | Browse view. |
| StudioViewGallery | `components/studio/studio-views.tsx` | — | Gallery (thumbnails) view. |
| StudioViewFaces | `components/studio/studio-views.tsx` | — | Faces view. |
| StudioViewPalettes | `components/studio/studio-views.tsx` | — | Palettes view. |
| StudioViewProjects | `components/studio/studio-views.tsx` | — | Projects view. |
| StudioViewStyles | `components/studio/studio-views.tsx` | — | Styles view. |
| StudioViewYouTube | `components/studio/studio-views.tsx` | — | YouTube import/view. |
| StyleCard | `components/studio/style-card.tsx` | `style`, `isFavorite?`, etc. (StyleCardProps) | Style card. |
| StyleCardEmpty | `components/studio/style-card.tsx` | — | Empty style card. |
| StyleCardSkeleton | `components/studio/style-card.tsx` | — | Skeleton for style card. |
| StyleEditor | `components/studio/style-editor.tsx` | `open`, `onOpenChange`, `style?` (StyleEditorProps) | Create/edit style modal. |
| StyleGrid | `components/studio/style-grid.tsx` | `styles`, `currentUserId?`, `favoriteIds?`, `minSlots?`, `showEmptySlots?` (StyleGridProps) | Grid of style thumbnail cards. |
| StyleGridSkeleton | `components/studio/style-grid.tsx` | `count?` | Skeleton for style grid. |
| StyleThumbnailCard | `components/studio/style-thumbnail-card.tsx` | `style`, `currentUserId?`, etc. (StyleThumbnailCardProps) | Style thumbnail card with actions. |
| StyleThumbnailCardEmpty | `components/studio/style-thumbnail-card.tsx` | — | Empty style thumbnail card. |
| StyleThumbnailCardSkeleton | `components/studio/style-thumbnail-card.tsx` | `text?` | Skeleton for style thumbnail card. |
| ThinkingMessage | `components/studio/thinking-message.tsx` | `thinkingState`, `isExpanded?`, `onToggleExpanded?` (ThinkingMessageProps) | Assistant “thinking” state message. |
| ThumbnailCard | `components/studio/thumbnail-card.tsx` | `thumbnail`, `priority?`, `draggable?`, etc. (ThumbnailCardProps) | Thumbnail card. |
| ThumbnailCardEmpty | `components/studio/thumbnail-card.tsx` | — | Empty thumbnail slot. |
| ThumbnailCardFailed | `components/studio/thumbnail-card.tsx` | `thumbnail`, `onRetry?`, etc. | Failed generation card with retry. |
| ThumbnailCardSkeleton | `components/studio/thumbnail-card.tsx` | `text?` | Skeleton for thumbnail card. |
| ThumbnailEditModal | `components/studio/thumbnail-edit-modal.tsx` | `open`, `onOpenChange`, `thumbnail` (ThumbnailEditModalProps) | Edit thumbnail metadata modal. |
| ThumbnailGrid | `components/studio/thumbnail-grid.tsx` | `thumbnails`, `generating?`, `minSlots?`, etc. (ThumbnailGridProps) | Grid of thumbnail cards. |
| ThumbnailGridSkeleton | `components/studio/thumbnail-grid.tsx` | `count?` | Skeleton for thumbnail grid. |
| ViewControls | `components/studio/view-controls.tsx` | `searchQuery?`, `onSearchChange?`, etc. (ViewControlsProps) | Search/sort/filter controls. |
| ViewHeader | `components/studio/view-controls.tsx` | `title`, `description?`, `count?` (ViewHeaderProps) | View title and optional description/count. |
| YouTubeStyleExtractBar | `components/studio/youtube-style-extract-bar.tsx` | `selectedCount`, `canExtract`, `isExtracting` (YouTubeStyleExtractBarProps) | Bar for extracting style from YouTube selection. |
| YouTubeVideoAnalyticsModal | `components/studio/youtube-video-analytics-modal.tsx` | `open`, `onOpenChange`, `video` (YouTubeVideoAnalyticsModalProps) | YouTube video analytics modal. |
| YouTubeVideoCard | `components/studio/youtube-video-card.tsx` | `video`, `priority?` (YouTubeVideoCardProps) | YouTube video card. |
| YouTubeVideoCardSkeleton | `components/studio/youtube-video-card.tsx` | — | Skeleton for YouTube video card. |

---

## 6. Components — Notifications

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| NotificationBell | `components/notifications/notification-bell.tsx` | `size?`, `className?` (NotificationBellProps) | Bell icon with notification state. |
| NotificationItem | `components/notifications/notification-item.tsx` | `notification`, `onClick`, `onArchive?` (NotificationItemProps) | Single notification row. |
| NotificationPopover | `components/notifications/notification-popover.tsx` | `onClose` (NotificationPopoverProps) | Popover containing notification list. |

---

## 7. Components — UI (Primitives & Design System)

*Props for UI components are typically `className`, `children`, and spread `React.ComponentProps` of the underlying primitive; only explicit prop types or notable props are listed.*

| Component | File path | Props / Parameters | Description |
|-----------|-----------|--------------------|-------------|
| Accordion | `components/ui/accordion.tsx` | React.ComponentProps of AccordionPrimitive.Root | Accordion root. |
| AccordionItem | `components/ui/accordion.tsx` | React.ComponentProps of AccordionPrimitive.Item | Accordion item. |
| AccordionTrigger | `components/ui/accordion.tsx` | — | Accordion trigger. |
| AccordionContent | `components/ui/accordion.tsx` | — | Accordion content. |
| Alert | `components/ui/alert.tsx` | variantProps (cva) + div props | Alert container. |
| AlertTitle | `components/ui/alert.tsx` | — | Alert title. |
| AlertDescription | `components/ui/alert.tsx` | — | Alert description. |
| AlertAction | `components/ui/alert.tsx` | — | Alert action. |
| AlertDialog | `components/ui/alert-dialog.tsx` | Radix AlertDialog props | Alert dialog root. |
| AlertDialogAction | `components/ui/alert-dialog.tsx` | — | Alert dialog action button. |
| AlertDialogCancel | `components/ui/alert-dialog.tsx` | — | Alert dialog cancel button. |
| AlertDialogContent | `components/ui/alert-dialog.tsx` | — | Alert dialog content. |
| AlertDialogDescription | `components/ui/alert-dialog.tsx` | — | Alert dialog description. |
| AlertDialogFooter | `components/ui/alert-dialog.tsx` | — | Alert dialog footer. |
| AlertDialogHeader | `components/ui/alert-dialog.tsx` | — | Alert dialog header. |
| AlertDialogMedia | `components/ui/alert-dialog.tsx` | — | Alert dialog media slot. |
| AlertDialogOverlay | `components/ui/alert-dialog.tsx` | — | Alert dialog overlay. |
| AlertDialogPortal | `components/ui/alert-dialog.tsx` | — | Alert dialog portal. |
| AlertDialogTitle | `components/ui/alert-dialog.tsx` | — | Alert dialog title. |
| AlertDialogTrigger | `components/ui/alert-dialog.tsx` | — | Alert dialog trigger. |
| AspectRatio | `components/ui/aspect-ratio.tsx` | ratio, etc. | Aspect ratio wrapper. |
| Avatar | `components/ui/avatar.tsx` | — | Avatar root. |
| AvatarImage | `components/ui/avatar.tsx` | — | Avatar image. |
| AvatarFallback | `components/ui/avatar.tsx` | — | Avatar fallback. |
| AvatarGroup | `components/ui/avatar.tsx` | — | Avatar group. |
| AvatarGroupCount | `components/ui/avatar.tsx` | — | Avatar group count. |
| AvatarBadge | `components/ui/avatar.tsx` | — | Avatar badge. |
| Badge | `components/ui/badge.tsx` | variantProps + props | Badge; exports badgeVariants. |
| Breadcrumb | `components/ui/breadcrumb.tsx` | — | Breadcrumb root. |
| BreadcrumbList | `components/ui/breadcrumb.tsx` | — | Breadcrumb list. |
| BreadcrumbItem | `components/ui/breadcrumb.tsx` | — | Breadcrumb item. |
| BreadcrumbLink | `components/ui/breadcrumb.tsx` | — | Breadcrumb link. |
| BreadcrumbPage | `components/ui/breadcrumb.tsx` | — | Breadcrumb current page. |
| BreadcrumbSeparator | `components/ui/breadcrumb.tsx` | — | Breadcrumb separator. |
| BreadcrumbEllipsis | `components/ui/breadcrumb.tsx` | — | Breadcrumb ellipsis. |
| Button | `components/ui/button.tsx` | variant, size, asChild, etc. (cva) | Button; exports buttonVariants. |
| ButtonGroup | `components/ui/button-group.tsx` | variantProps + props | Button group container; exports buttonGroupVariants. |
| ButtonGroupSeparator | `components/ui/button-group.tsx` | — | Separator in button group. |
| ButtonGroupText | `components/ui/button-group.tsx` | — | Text in button group. |
| Calendar | `components/ui/calendar.tsx` | — | Calendar component. |
| CalendarDayButton | `components/ui/calendar.tsx` | — | Calendar day button. |
| Card | `components/ui/card.tsx` | — | Card root. |
| CardHeader | `components/ui/card.tsx` | — | Card header. |
| CardFooter | `components/ui/card.tsx` | — | Card footer. |
| CardTitle | `components/ui/card.tsx` | — | Card title. |
| CardAction | `components/ui/card.tsx` | — | Card action. |
| CardDescription | `components/ui/card.tsx` | — | Card description. |
| CardContent | `components/ui/card.tsx` | — | Card content. |
| Carousel | `components/ui/carousel.tsx` | — | Carousel; exports CarouselApi, useCarousel. |
| CarouselContent | `components/ui/carousel.tsx` | — | Carousel content. |
| CarouselItem | `components/ui/carousel.tsx` | — | Carousel item. |
| CarouselPrevious | `components/ui/carousel.tsx` | — | Carousel previous. |
| CarouselNext | `components/ui/carousel.tsx` | — | Carousel next. |
| ChartContainer | `components/ui/chart.tsx` | — | Chart container. |
| ChartTooltip | `components/ui/chart.tsx` | — | Chart tooltip. |
| ChartTooltipContent | `components/ui/chart.tsx` | — | Chart tooltip content. |
| ChartLegend | `components/ui/chart.tsx` | — | Chart legend. |
| ChartLegendContent | `components/ui/chart.tsx` | — | Chart legend content. |
| ChartStyle | `components/ui/chart.tsx` | — | Chart style. |
| Checkbox | `components/ui/checkbox.tsx` | — | Checkbox. |
| CloseButton | `components/ui/close-button.tsx` | size?, ...ButtonProps (CloseButtonProps) | Close (X) button. |
| Collapsible | `components/ui/collapsible.tsx` | — | Collapsible root. |
| CollapsibleTrigger | `components/ui/collapsible.tsx` | — | Collapsible trigger. |
| CollapsibleContent | `components/ui/collapsible.tsx` | — | Collapsible content. |
| Combobox | `components/ui/combobox.tsx` | — | Combobox root. |
| ComboboxInput | `components/ui/combobox.tsx` | — | Combobox input. |
| ComboboxContent | `components/ui/combobox.tsx` | — | Combobox content. |
| ComboboxList | `components/ui/combobox.tsx` | — | Combobox list. |
| ComboboxItem | `components/ui/combobox.tsx` | — | Combobox item. |
| ComboboxGroup | `components/ui/combobox.tsx` | — | Combobox group. |
| ComboboxLabel | `components/ui/combobox.tsx` | — | Combobox label. |
| ComboboxCollection | `components/ui/combobox.tsx` | — | Combobox collection. |
| ComboboxEmpty | `components/ui/combobox.tsx` | — | Combobox empty state. |
| ComboboxSeparator | `components/ui/combobox.tsx` | — | Combobox separator. |
| ComboboxChips | `components/ui/combobox.tsx` | — | Combobox chips. |
| ComboboxChip | `components/ui/combobox.tsx` | — | Combobox chip. |
| ComboboxChipsInput | `components/ui/combobox.tsx` | — | Combobox chips input. |
| ComboboxTrigger | `components/ui/combobox.tsx` | — | Combobox trigger. |
| ComboboxValue | `components/ui/combobox.tsx` | — | Combobox value. |
| Command | `components/ui/command.tsx` | — | Command root. |
| CommandDialog | `components/ui/command.tsx` | — | Command dialog. |
| CommandInput | `components/ui/command.tsx` | — | Command input. |
| CommandList | `components/ui/command.tsx` | — | Command list. |
| CommandEmpty | `components/ui/command.tsx` | — | Command empty. |
| CommandGroup | `components/ui/command.tsx` | — | Command group. |
| CommandItem | `components/ui/command.tsx` | — | Command item. |
| CommandShortcut | `components/ui/command.tsx` | — | Command shortcut. |
| CommandSeparator | `components/ui/command.tsx` | — | Command separator. |
| ContextMenu | `components/ui/context-menu.tsx` | — | Context menu root. |
| ContextMenuTrigger | `components/ui/context-menu.tsx` | — | Context menu trigger. |
| ContextMenuContent | `components/ui/context-menu.tsx` | — | Context menu content. |
| ContextMenuItem | `components/ui/context-menu.tsx` | — | Context menu item. |
| ContextMenuCheckboxItem | `components/ui/context-menu.tsx` | — | Context menu checkbox item. |
| ContextMenuRadioItem | `components/ui/context-menu.tsx` | — | Context menu radio item. |
| ContextMenuLabel | `components/ui/context-menu.tsx` | — | Context menu label. |
| ContextMenuSeparator | `components/ui/context-menu.tsx` | — | Context menu separator. |
| ContextMenuShortcut | `components/ui/context-menu.tsx` | — | Context menu shortcut. |
| ContextMenuGroup | `components/ui/context-menu.tsx` | — | Context menu group. |
| ContextMenuPortal | `components/ui/context-menu.tsx` | — | Context menu portal. |
| ContextMenuSub | `components/ui/context-menu.tsx` | — | Context menu sub. |
| ContextMenuSubContent | `components/ui/context-menu.tsx` | — | Context menu sub content. |
| ContextMenuSubTrigger | `components/ui/context-menu.tsx` | — | Context menu sub trigger. |
| ContextMenuRadioGroup | `components/ui/context-menu.tsx` | — | Context menu radio group. |
| CRTLoadingEffect | `components/ui/crt-loading-effect.tsx` | `showProgress?`, `className?`, `style?`, `variant?` (CRTLoadingEffectProps) | Retro CRT loading effect. |
| Dialog | `components/ui/dialog.tsx` | — | Dialog root. |
| DialogClose | `components/ui/dialog.tsx` | — | Dialog close. |
| DialogContent | `components/ui/dialog.tsx` | — | Dialog content. |
| DialogDescription | `components/ui/dialog.tsx` | — | Dialog description. |
| DialogFooter | `components/ui/dialog.tsx` | — | Dialog footer. |
| DialogHeader | `components/ui/dialog.tsx` | — | Dialog header. |
| DialogOverlay | `components/ui/dialog.tsx` | — | Dialog overlay. |
| DialogPortal | `components/ui/dialog.tsx` | — | Dialog portal. |
| DialogTitle | `components/ui/dialog.tsx` | — | Dialog title. |
| DialogTrigger | `components/ui/dialog.tsx` | — | Dialog trigger. |
| Drawer | `components/ui/drawer.tsx` | — | Drawer root. |
| DrawerPortal | `components/ui/drawer.tsx` | — | Drawer portal. |
| DrawerOverlay | `components/ui/drawer.tsx` | — | Drawer overlay. |
| DrawerTrigger | `components/ui/drawer.tsx` | — | Drawer trigger. |
| DrawerClose | `components/ui/drawer.tsx` | — | Drawer close. |
| DrawerContent | `components/ui/drawer.tsx` | — | Drawer content. |
| DrawerHeader | `components/ui/drawer.tsx` | — | Drawer header. |
| DrawerFooter | `components/ui/drawer.tsx` | — | Drawer footer. |
| DrawerTitle | `components/ui/drawer.tsx` | — | Drawer title. |
| DrawerDescription | `components/ui/drawer.tsx` | — | Drawer description. |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | — | Dropdown menu root. |
| DropdownMenuPortal | `components/ui/dropdown-menu.tsx` | — | Dropdown menu portal. |
| DropdownMenuTrigger | `components/ui/dropdown-menu.tsx` | — | Dropdown menu trigger. |
| DropdownMenuContent | `components/ui/dropdown-menu.tsx` | — | Dropdown menu content. |
| DropdownMenuGroup | `components/ui/dropdown-menu.tsx` | — | Dropdown menu group. |
| DropdownMenuLabel | `components/ui/dropdown-menu.tsx` | — | Dropdown menu label. |
| DropdownMenuItem | `components/ui/dropdown-menu.tsx` | — | Dropdown menu item. |
| DropdownMenuCheckboxItem | `components/ui/dropdown-menu.tsx` | — | Dropdown menu checkbox item. |
| DropdownMenuRadioGroup | `components/ui/dropdown-menu.tsx` | — | Dropdown menu radio group. |
| DropdownMenuRadioItem | `components/ui/dropdown-menu.tsx` | — | Dropdown menu radio item. |
| DropdownMenuSeparator | `components/ui/dropdown-menu.tsx` | — | Dropdown menu separator. |
| DropdownMenuShortcut | `components/ui/dropdown-menu.tsx` | — | Dropdown menu shortcut. |
| DropdownMenuSub | `components/ui/dropdown-menu.tsx` | — | Dropdown menu sub. |
| DropdownMenuSubTrigger | `components/ui/dropdown-menu.tsx` | — | Dropdown menu sub trigger. |
| DropdownMenuSubContent | `components/ui/dropdown-menu.tsx` | — | Dropdown menu sub content. |
| Empty | `components/ui/empty.tsx` | — | Empty state root. |
| EmptyHeader | `components/ui/empty.tsx` | — | Empty state header. |
| EmptyTitle | `components/ui/empty.tsx` | — | Empty state title. |
| EmptyDescription | `components/ui/empty.tsx` | — | Empty state description. |
| EmptyContent | `components/ui/empty.tsx` | — | Empty state content. |
| EmptyMedia | `components/ui/empty.tsx` | — | Empty state media. |
| Field | `components/ui/field.tsx` | — | Field root. |
| FieldLabel | `components/ui/field.tsx` | — | Field label. |
| FieldDescription | `components/ui/field.tsx` | — | Field description. |
| FieldError | `components/ui/field.tsx` | — | Field error. |
| FieldGroup | `components/ui/field.tsx` | — | Field group. |
| FieldLegend | `components/ui/field.tsx` | — | Field legend. |
| FieldSeparator | `components/ui/field.tsx` | — | Field separator. |
| FieldSet | `components/ui/field.tsx` | — | Field set. |
| FieldContent | `components/ui/field.tsx` | — | Field content. |
| FieldTitle | `components/ui/field.tsx` | — | Field title. |
| FloatingButton | `components/ui/floating-button.tsx` | `className?`, `children`, `triggerContent`, `onOpenChange?` (FloatingButtonProps) | Floating action button with menu. |
| FloatingButtonItem | `components/ui/floating-button.tsx` | `children`, `label?` (FloatingButtonItemProps) | Item in floating button menu. |
| HoverCard | `components/ui/hover-card.tsx` | — | Hover card root. |
| HoverCardTrigger | `components/ui/hover-card.tsx` | — | Hover card trigger. |
| HoverCardContent | `components/ui/hover-card.tsx` | — | Hover card content. |
| Input | `components/ui/input.tsx` | — | Text input. |
| InputGroup | `components/ui/input-group.tsx` | — | Input group root. |
| InputGroupAddon | `components/ui/input-group.tsx` | — | Input group addon. |
| InputGroupButton | `components/ui/input-group.tsx` | — | Input group button. |
| InputGroupText | `components/ui/input-group.tsx` | — | Input group text. |
| InputGroupInput | `components/ui/input-group.tsx` | — | Input group input. |
| InputGroupTextarea | `components/ui/input-group.tsx` | — | Input group textarea. |
| InputOTP | `components/ui/input-otp.tsx` | — | OTP input. |
| InputOTPGroup | `components/ui/input-otp.tsx` | — | OTP group. |
| InputOTPSlot | `components/ui/input-otp.tsx` | — | OTP slot. |
| InputOTPSeparator | `components/ui/input-otp.tsx` | — | OTP separator. |
| Item | `components/ui/item.tsx` | — | Item root. |
| ItemMedia | `components/ui/item.tsx` | — | Item media. |
| ItemContent | `components/ui/item.tsx` | — | Item content. |
| ItemActions | `components/ui/item.tsx` | — | Item actions. |
| ItemGroup | `components/ui/item.tsx` | — | Item group. |
| ItemSeparator | `components/ui/item.tsx` | — | Item separator. |
| ItemTitle | `components/ui/item.tsx` | — | Item title. |
| ItemDescription | `components/ui/item.tsx` | — | Item description. |
| ItemHeader | `components/ui/item.tsx` | — | Item header. |
| ItemFooter | `components/ui/item.tsx` | — | Item footer. |
| Kbd | `components/ui/kbd.tsx` | — | Keyboard key. |
| KbdGroup | `components/ui/kbd.tsx` | — | Keyboard key group. |
| Label | `components/ui/label.tsx` | — | Form label. |
| Menubar | `components/ui/menubar.tsx` | — | Menubar root. |
| MenubarPortal | `components/ui/menubar.tsx` | — | Menubar portal. |
| MenubarMenu | `components/ui/menubar.tsx` | — | Menubar menu. |
| MenubarTrigger | `components/ui/menubar.tsx` | — | Menubar trigger. |
| MenubarContent | `components/ui/menubar.tsx` | — | Menubar content. |
| MenubarGroup | `components/ui/menubar.tsx` | — | Menubar group. |
| MenubarSeparator | `components/ui/menubar.tsx` | — | Menubar separator. |
| MenubarLabel | `components/ui/menubar.tsx` | — | Menubar label. |
| MenubarItem | `components/ui/menubar.tsx` | — | Menubar item. |
| MenubarShortcut | `components/ui/menubar.tsx` | — | Menubar shortcut. |
| MenubarCheckboxItem | `components/ui/menubar.tsx` | — | Menubar checkbox item. |
| MenubarRadioGroup | `components/ui/menubar.tsx` | — | Menubar radio group. |
| MenubarRadioItem | `components/ui/menubar.tsx` | — | Menubar radio item. |
| MenubarSub | `components/ui/menubar.tsx` | — | Menubar sub. |
| MenubarSubTrigger | `components/ui/menubar.tsx` | — | Menubar sub trigger. |
| MenubarSubContent | `components/ui/menubar.tsx` | — | Menubar sub content. |
| Modal | `components/ui/modal.tsx` | — | Modal root. |
| ModalTrigger | `components/ui/modal.tsx` | — | Modal trigger. |
| ModalPortal | `components/ui/modal.tsx` | — | Modal portal. |
| ModalClose | `components/ui/modal.tsx` | — | Modal close. |
| ModalOverlay | `components/ui/modal.tsx` | — | Modal overlay. |
| ModalContent | `components/ui/modal.tsx` | variantProps + props | Modal content. |
| ModalHeader | `components/ui/modal.tsx` | — | Modal header. |
| ModalBody | `components/ui/modal.tsx` | — | Modal body. |
| ModalFooter | `components/ui/modal.tsx` | — | Modal footer. |
| ModalTitle | `components/ui/modal.tsx` | — | Modal title. |
| ModalDescription | `components/ui/modal.tsx` | — | Modal description. |
| ImageModal | `components/ui/modal.tsx` | `open`, `onOpenChange`, `src`, `alt`, `title?` (ImageModalProps) | Image display modal. |
| PaletteViewModal | `components/ui/modal.tsx` | `open`, `onOpenChange`, `name`, `colors` (PaletteViewModalProps) | Palette color view modal. |
| NavigationMenu | `components/ui/navigation-menu.tsx` | — | Navigation menu root. |
| NavigationMenuList | `components/ui/navigation-menu.tsx` | — | Navigation menu list. |
| NavigationMenuItem | `components/ui/navigation-menu.tsx` | — | Navigation menu item. |
| NavigationMenuContent | `components/ui/navigation-menu.tsx` | — | Navigation menu content. |
| NavigationMenuTrigger | `components/ui/navigation-menu.tsx` | — | Navigation menu trigger. |
| NavigationMenuLink | `components/ui/navigation-menu.tsx` | — | Navigation menu link. |
| NavigationMenuIndicator | `components/ui/navigation-menu.tsx` | — | Navigation menu indicator. |
| NavigationMenuViewport | `components/ui/navigation-menu.tsx` | — | Navigation menu viewport. |
| Pagination | `components/ui/pagination.tsx` | — | Pagination root. |
| PaginationContent | `components/ui/pagination.tsx` | — | Pagination content. |
| PaginationEllipsis | `components/ui/pagination.tsx` | — | Pagination ellipsis. |
| PaginationItem | `components/ui/pagination.tsx` | — | Pagination item. |
| PaginationLink | `components/ui/pagination.tsx` | — | Pagination link. |
| PaginationNext | `components/ui/pagination.tsx` | — | Pagination next. |
| PaginationPrevious | `components/ui/pagination.tsx` | — | Pagination previous. |
| Popover | `components/ui/popover.tsx` | — | Popover root. |
| PopoverAnchor | `components/ui/popover.tsx` | — | Popover anchor. |
| PopoverContent | `components/ui/popover.tsx` | — | Popover content. |
| PopoverDescription | `components/ui/popover.tsx` | — | Popover description. |
| PopoverHeader | `components/ui/popover.tsx` | — | Popover header. |
| PopoverTitle | `components/ui/popover.tsx` | — | Popover title. |
| PopoverTrigger | `components/ui/popover.tsx` | — | Popover trigger. |
| Progress | `components/ui/progress.tsx` | — | Progress bar. |
| RadioGroup | `components/ui/radio-group.tsx` | — | Radio group root. |
| RadioGroupItem | `components/ui/radio-group.tsx` | — | Radio group item. |
| ResizablePanelGroup | `components/ui/resizable.tsx` | — | Resizable panel group. |
| ResizablePanel | `components/ui/resizable.tsx` | — | Resizable panel. |
| ResizableHandle | `components/ui/resizable.tsx` | — | Resizable handle. |
| ScrollArea | `components/ui/scroll-area.tsx` | — | Scroll area. |
| ScrollBar | `components/ui/scroll-area.tsx` | — | Scroll bar. |
| Select | `components/ui/select.tsx` | — | Select root. |
| SelectContent | `components/ui/select.tsx` | — | Select content. |
| SelectGroup | `components/ui/select.tsx` | — | Select group. |
| SelectItem | `components/ui/select.tsx` | — | Select item. |
| SelectLabel | `components/ui/select.tsx` | — | Select label. |
| SelectScrollDownButton | `components/ui/select.tsx` | — | Select scroll down. |
| SelectScrollUpButton | `components/ui/select.tsx` | — | Select scroll up. |
| SelectSeparator | `components/ui/select.tsx` | — | Select separator. |
| SelectTrigger | `components/ui/select.tsx` | — | Select trigger. |
| SelectValue | `components/ui/select.tsx` | — | Select value. |
| Separator | `components/ui/separator.tsx` | — | Separator. |
| Sheet | `components/ui/sheet.tsx` | — | Sheet root. |
| SheetTrigger | `components/ui/sheet.tsx` | — | Sheet trigger. |
| SheetClose | `components/ui/sheet.tsx` | — | Sheet close. |
| SheetContent | `components/ui/sheet.tsx` | — | Sheet content. |
| SheetHeader | `components/ui/sheet.tsx` | — | Sheet header. |
| SheetFooter | `components/ui/sheet.tsx` | — | Sheet footer. |
| SheetTitle | `components/ui/sheet.tsx` | — | Sheet title. |
| SheetDescription | `components/ui/sheet.tsx` | — | Sheet description. |
| Sidebar | `components/ui/sidebar.tsx` | — | Sidebar root. |
| SidebarContent | `components/ui/sidebar.tsx` | — | Sidebar content. |
| SidebarFooter | `components/ui/sidebar.tsx` | — | Sidebar footer. |
| SidebarGroup | `components/ui/sidebar.tsx` | — | Sidebar group. |
| SidebarGroupAction | `components/ui/sidebar.tsx` | — | Sidebar group action. |
| SidebarGroupContent | `components/ui/sidebar.tsx` | — | Sidebar group content. |
| SidebarGroupLabel | `components/ui/sidebar.tsx` | — | Sidebar group label. |
| SidebarHeader | `components/ui/sidebar.tsx` | — | Sidebar header. |
| SidebarInput | `components/ui/sidebar.tsx` | — | Sidebar input. |
| SidebarInset | `components/ui/sidebar.tsx` | — | Sidebar inset. |
| SidebarMenu | `components/ui/sidebar.tsx` | — | Sidebar menu. |
| SidebarMenuAction | `components/ui/sidebar.tsx` | — | Sidebar menu action. |
| SidebarMenuBadge | `components/ui/sidebar.tsx` | — | Sidebar menu badge. |
| SidebarMenuButton | `components/ui/sidebar.tsx` | — | Sidebar menu button. |
| SidebarMenuItem | `components/ui/sidebar.tsx` | — | Sidebar menu item. |
| SidebarMenuSkeleton | `components/ui/sidebar.tsx` | — | Sidebar menu skeleton. |
| SidebarMenuSub | `components/ui/sidebar.tsx` | — | Sidebar menu sub. |
| SidebarMenuSubButton | `components/ui/sidebar.tsx` | — | Sidebar menu sub button. |
| SidebarMenuSubItem | `components/ui/sidebar.tsx` | — | Sidebar menu sub item. |
| SidebarProvider | `components/ui/sidebar.tsx` | — | Sidebar provider. |
| SidebarRail | `components/ui/sidebar.tsx` | — | Sidebar rail. |
| SidebarSeparator | `components/ui/sidebar.tsx` | — | Sidebar separator. |
| SidebarTrigger | `components/ui/sidebar.tsx` | — | Sidebar trigger. |
| Skeleton | `components/ui/skeleton.tsx` | — | Skeleton placeholder. |
| Slider | `components/ui/slider.tsx` | — | Slider. |
| Sonner (Toaster) | `components/ui/sonner.tsx` | ToasterProps (sonner) | Toast container; exported as Toaster. |
| Spinner | `components/ui/spinner.tsx` | — | Spinner. |
| Switch | `components/ui/switch.tsx` | — | Switch. |
| Table | `components/ui/table.tsx` | — | Table root. |
| TableHeader | `components/ui/table.tsx` | — | Table header. |
| TableBody | `components/ui/table.tsx` | — | Table body. |
| TableFooter | `components/ui/table.tsx` | — | Table footer. |
| TableHead | `components/ui/table.tsx` | — | Table head cell. |
| TableRow | `components/ui/table.tsx` | — | Table row. |
| TableCell | `components/ui/table.tsx` | — | Table cell. |
| TableCaption | `components/ui/table.tsx` | — | Table caption. |
| Tabs | `components/ui/tabs.tsx` | — | Tabs root; exports tabsListVariants, tabsTriggerVariants. |
| TabsList | `components/ui/tabs.tsx` | — | Tabs list. |
| TabsTrigger | `components/ui/tabs.tsx` | — | Tabs trigger. |
| TabsContent | `components/ui/tabs.tsx` | — | Tabs content. |
| Textarea | `components/ui/textarea.tsx` | — | Textarea. |
| Toggle | `components/ui/toggle.tsx` | — | Toggle; exports toggleVariants. |
| ToggleGroup | `components/ui/toggle-group.tsx` | — | Toggle group. |
| ToggleGroupItem | `components/ui/toggle-group.tsx` | — | Toggle group item. |
| Tooltip | `components/ui/tooltip.tsx` | — | Tooltip root. |
| TooltipProvider | `components/ui/tooltip.tsx` | — | Tooltip provider. |
| TooltipTrigger | `components/ui/tooltip.tsx` | — | Tooltip trigger. |
| TooltipContent | `components/ui/tooltip.tsx` | — | Tooltip content. |
| ViewBaitLogo | `components/ui/viewbait-logo.tsx` | `className?`, `variant?` ("default" \| "white") | App logo (primary gradient or white). |

---

## Notes

- **Hooks** exported from component files (e.g. `useStudio`, `useStudioState`, `useThumbnailActions`, `useStyleActions`, `usePaletteActions`, `useOnboarding`, `useAuth`, `useRequireAuth`, `useSubscription`, `useLenisScroll`, `useSidebar`) are not listed as components.
- **Constants** (e.g. `navItems`, `DROP_ZONE_IDS`, `PROJECT_NONE_VALUE`, `DEFAULT_SORT_OPTIONS`, `buttonVariants`, `modalContentVariants`) are not listed.
- **App route handlers** under `app/api/` are not front-end components and are excluded.
- **Skill/agent examples** under `.agents/` are excluded from this report.
- Paths are relative to the `viewbait` directory.
