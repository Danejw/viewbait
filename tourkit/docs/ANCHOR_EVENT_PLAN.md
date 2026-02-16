# TourKit Anchor + Event Plan

## Naming rules (contract)

### Anchor attribute
- Use `data-tour="..."` only.
- Every value starts with `tour.`.

### Anchor grammar
`tour.<route>.<area>.<type>.<name>[.<variant>]`

### Allowed `<type>` values
`cta`, `btn`, `input`, `select`, `tab`, `card`, `grid`, `item`, `modal`, `chip`, `toggle`, `text`, `link`, `label`, `container`, `image`, `badge`, `progress`

### Event grammar
`tour.event.<domain>.<name>`

---

## Multi-tour plan

1. **first-thumbnail**: First-time user lands on home, authenticates, opens studio, and generates first thumbnail. Routes: `/`, `/auth`, `/studio`.
2. **onboarding-first-thumbnail**: User runs guided onboarding wizard to create a first thumbnail. Routes: `/onboarding`, `/studio`.
3. **custom-instructions**: User enters custom instructions and generates thumbnail variations. Route: `/studio`.
4. **youtube-assisted-generation**: User opens YouTube view, selects a video context, and generates from it. Route: `/studio`.
5. **style-and-face-workflow**: User selects or uploads style/face assets and generates. Route: `/studio`.
6. **password-recovery**: User requests reset email and completes reset flow. Routes: `/auth/forgot-password`, `/auth/reset-password`.
7. **shared-gallery-view**: User opens a public/shared project gallery and inspects items. Route: `/p/[slug]`.
8. **editor-link-entry**: User opens editor invite slug and lands in studio context. Route: `/e/[slug]`.

---

## Shared fragments

- **login** fragment is shared by tours 1, 3, 4, and 5.
  - Segment: `home -> auth -> authenticated -> studio`.
- Optional future fragment (not created in this prompt): `open-studio` from home CTA.

---

## Per-route minimum anchor table

## Route: home (path: `/`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.home.nav.link.signIn` | Header Sign In link | Entry to auth flow |
| `tour.home.hero.cta.startCreating` | Main hero CTA (studio/auth) | Primary conversion CTA |
| `tour.home.nav.btn.mobileMenu` | Mobile menu toggle button | Needed for mobile path |
| `tour.home.mobileMenu.link.getStarted` | Mobile menu auth/studio link | Mobile equivalent path |

Implementation locations: `app/page.tsx` (nav/header block and hero CTA block).

## Route: auth (path: `/auth`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.auth.form.tab.signin` | Sign in tab trigger | Switches mode |
| `tour.auth.form.tab.signup` | Sign up tab trigger | Switches mode |
| `tour.auth.form.input.email` | Sign-in email input | Used in login fragment |
| `tour.auth.form.input.password` | Sign-in password input | Used in login fragment |
| `tour.auth.form.btn.submit` | Sign-in submit button | Used in login fragment |
| `tour.auth.form.link.forgotPassword` | Forgot password button/link | Password-recovery tour |
| `tour.auth.form.btn.google` | Continue with Google button | OAuth coverage |
| `tour.auth.signup.input.fullName` | Sign-up full name input | Sign-up tour path |
| `tour.auth.signup.input.email` | Sign-up email input | Sign-up path |
| `tour.auth.signup.input.password` | Sign-up password input | Sign-up path |
| `tour.auth.signup.input.confirmPassword` | Sign-up confirm password input | Sign-up path |
| `tour.auth.signup.input.referralCode` | Referral code input | Optional path |
| `tour.auth.signup.btn.submit` | Create account submit button | Sign-up path |

Implementation locations: `app/auth/page.tsx` inside `<TabsTrigger>`, sign-in form, sign-up form, and Google button.

## Route: auth.forgot (path: `/auth/forgot-password`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.auth.forgot.form.input.email` | Forgot-password email input | Recovery flow |
| `tour.auth.forgot.form.btn.submit` | Send reset link button | Recovery flow |
| `tour.auth.forgot.state.btn.tryAgain` | Try again button in success state | Conditional anchor, note success-only rendering |
| `tour.auth.forgot.state.link.backToSignin` | Back to sign in link | Recovery flow |

Implementation locations: `app/auth/forgot-password/page.tsx` in form and success state action block.

## Route: auth.reset (path: `/auth/reset-password`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.auth.reset.form.input.newPassword` | New password input | Reset flow |
| `tour.auth.reset.form.input.confirmPassword` | Confirm password input | Reset flow |
| `tour.auth.reset.form.btn.submit` | Update password button | Reset flow |
| `tour.auth.reset.state.link.backToSignin` | Back to sign in link after success | Success-only rendering |

Implementation locations: `app/auth/reset-password/page.tsx` in reset form and success actions.

## Route: onboarding (path: `/onboarding`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.onboarding.welcome.cta.getStarted` | Get started button | Starts multi-step flow |
| `tour.onboarding.welcome.btn.skipToStudio` | Skip to studio button | Optional branch |
| `tour.onboarding.flow.progress.step` | Step progress indicator | Verification point |
| `tour.onboarding.flow.input.thumbnailTitle` | Title entry input (step 2) | Reuses studio generator component |
| `tour.onboarding.flow.btn.next` | Generic next/continue button | Moves between steps |
| `tour.onboarding.flow.btn.generate` | Generate button | Core async action |
| `tour.onboarding.success.btn.openStudio` | Final continue/open studio action | Terminal action |

Implementation locations: `app/onboarding/page.tsx` and reused generator controls from `components/studio/studio-generator.tsx` used by onboarding steps.

## Route: studio.create (path: `/studio`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.studio.sidebar.btn.create` | Left sidebar Create nav item | Stable entry view |
| `tour.studio.sidebar.btn.youtube` | Left sidebar YouTube nav item | YouTube tour |
| `tour.studio.settings.tab.manual` | Manual mode tab button | Core control |
| `tour.studio.settings.tab.chat` | Chat mode tab button | Alternate control |
| `tour.studio.form.input.thumbnailTitle` | Thumbnail title input | Core generation input |
| `tour.studio.form.input.customInstructions` | Custom instructions textarea | Custom instructions tour |
| `tour.studio.form.toggle.includeFaces` | Include faces switch | Feature toggle |
| `tour.studio.form.toggle.includeStyles` | Include styles switch | Feature toggle |
| `tour.studio.form.toggle.includePalettes` | Include palettes switch | Feature toggle |
| `tour.studio.form.select.aspectRatio` | Aspect ratio select trigger | Variant control |
| `tour.studio.form.select.resolution` | Resolution select trigger | Variant control |
| `tour.studio.form.select.variations` | Variations select trigger | Variant control |
| `tour.studio.form.btn.generate` | Generate thumbnail button | Core async action |
| `tour.studio.form.option.aspectRatio.16x9` | Aspect ratio option 16:9 | First-thumbnail happy path |
| `tour.studio.form.option.resolution.1k` | Resolution option 1K | First-thumbnail happy path |
| `tour.studio.form.option.variations.1` | Variations option 1 | First-thumbnail happy path |
| `tour.studio.results.card.thumbnail` | Generated thumbnail card (click to open) | Results interaction |
| `tour.studio.results.container.main` | Results panel container | Route-ready + existence check |
| `tour.studio.results.grid.thumbnails` | Thumbnail grid wrapper | Async completion target |
| `tour.studio.results.btn.refresh` | Results refresh button | Common action |
| `tour.studio.results.select.sort` | Sort select trigger | Common action |
| `tour.studio.modal.thumbnailView` | Thumbnail view modal root | Modal events |
| `tour.studio.modal.thumbnailEdit` | Thumbnail edit modal root | Modal events |
| `tour.studio.modal.youtubeAnalytics` | YouTube analytics modal root | Modal events |

Implementation locations:
- `components/studio/studio-sidebar.tsx` (left navigation buttons)
- `components/studio/studio-generator.tsx` (manual/chat tabs and form controls)
- `components/studio/studio-results.tsx` / `components/studio/thumbnail-grid.tsx` (results anchors)
- modal components: `components/studio/thumbnail-edit-modal.tsx`, `components/studio/snapshot-view-modal.tsx`, `components/studio/youtube-video-analytics-modal.tsx`, `components/studio/youtube-video-watch-and-analytics-modal.tsx`.

## Route: share.project (path: `/p/[slug]`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.share.project.header.container.main` | Shared gallery header container | Ready check |
| `tour.share.project.grid.thumbnails` | Shared thumbnails grid | Core content |
| `tour.share.project.card.item.thumbnail` | Shared gallery card item | Repeated item |

Implementation location: `app/p/[slug]/page.tsx` and shared gallery card/header components imported there.

## Route: share.editor (path: `/e/[slug]`)

| Anchor | Element | Notes |
|---|---|---|
| `tour.share.editor.state.progress` | Loading state container | Entry state |
| `tour.share.editor.state.error` | Error state container | Error path |
| `tour.share.editor.btn.goStudio` | Error-state go to studio link | Recovery action |

Implementation location: `app/e/[slug]/page.tsx`.

---

## Per-event table

| Event | When to emit | Payload | Implementation location |
|---|---|---|---|
| `tour.event.route.ready` | After page key anchors mount and UI is interactive | `{ routeKey, anchorsPresent }` | Page-level `useEffect` in `app/page.tsx`, `app/auth/page.tsx`, `app/onboarding/page.tsx`, and `app/studio/page.tsx` (or child mounted once per route) |
| `tour.event.auth.started` | Immediately before email/password or OAuth sign-in attempt starts | `{ method: "password" \| "google" }` | `app/auth/page.tsx` in `handleSignIn` and `handleGoogleSignIn` |
| `tour.event.auth.success` | After authentication success is confirmed, before redirecting to studio | `{ method, redirectTo }` | `app/auth/page.tsx` after successful sign-in and in auth-state success branch (`useAuth` listener in `lib/hooks/useAuth.tsx` can centralize) |
| `tour.event.auth.failed` | When sign-in/sign-up fails and error is displayed | `{ method, message }` | `app/auth/page.tsx` catch/error branch |
| `tour.event.modal.opened` | Any tour-relevant modal is opened | `{ modal: "thumbnailView" \| "thumbnailEdit" \| "youtubeAnalytics" }` | Modal roots in `components/studio/*modal*.tsx` via open state effect |
| `tour.event.modal.closed` | Any tour-relevant modal is closed | `{ modal }` | Same modal components on close handler |
| `tour.event.studio.generate.started` | User clicks Generate and request begins | `{ mode, projectId, variations }` | `components/studio/studio-provider.tsx` `generateThumbnails` action |
| `tour.event.studio.generate.complete` | Generation resolves and new thumbnails are available | `{ count, projectId }` | `components/studio/studio-provider.tsx` after successful generation and state update |
| `tour.event.studio.generate.failed` | Generation fails and error state is set | `{ message }` | `components/studio/studio-provider.tsx` error path |
| `tour.event.results.updated` | Results grid receives new items (from generate or refresh) | `{ total }` | `components/studio/studio-results.tsx` effect when combined thumbnails list changes |
| `tour.event.onboarding.step.changed` | Onboarding step index changes | `{ step, stepName }` | `app/onboarding/page.tsx` where step state updates |
| `tour.event.onboarding.complete` | Onboarding flow reaches success completion state | `{ redirectedTo: "/studio" }` | `app/onboarding/page.tsx` final success handler |

---

## Implementation notes and known uncertainty

- `/studio` is a single route with state-driven subviews (create, gallery, browse, youtube, etc.) rather than URL-based child routes. RouteKey remains `studio.create`; subview-specific anchors should live under `tour.studio.<area>...` rather than introducing fake paths.
- Route-ready event can be emitted by a small utility helper in a shared client util file and invoked from each route component.
- Some controls are conditionally rendered (success states, modals, feature-gated toggles). Tours must note those conditions and avoid assuming presence before the prerequisite action.
