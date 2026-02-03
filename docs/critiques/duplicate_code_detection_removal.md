# Duplicate Code Detection & Removal — Analysis

## Implementation status (refactor completed)

**All five original patterns have been implemented:**

- **Pattern 1** — API routes use `handleApiError()` or `handleStorageApiError()` in catch blocks; `handleStorageApiError` added in `api-helpers.ts` for storage routes.
- **Pattern 2** — Shared `SnapshotsStrip` in `components/studio/snapshots-strip.tsx`; `PlaceSnapshotsStrip` and `CharacterSnapshotsStrip` are thin wrappers.
- **Pattern 3** — Shared `ActionButton` exported from `action-bar-icon.tsx`; used by thumbnail-card, palette-thumbnail-card, style-thumbnail-card, face-thumbnail, youtube-video-card.
- **Pattern 4** — `lib/utils/grid-visibility.ts` with `GRID_ABOVE_FOLD_DEFAULT`, `GRID_ABOVE_FOLD_PALETTE`, and `gridItemAboveFoldClass()`; all three grids use it.
- **Pattern 5** — `lib/utils/clipboard.ts` with `copyToClipboardWithToast()`; used in referral-modal, share-project-dialog, studio-provider, youtube-video-card, youtube-video-analytics-modal.

---

## High-level overview (plain language)

*(Previous patterns 1–5 are now implemented; see Implementation status above.)*

1. **API error handling** — Many route handlers use a manual `try/catch` that (a) checks `if (error instanceof NextResponse) return error` and (b) then calls `serverErrorResponse(...)` or `storageErrorResponse(...)`. The existing `handleApiError()` in `api-helpers.ts` already does the NextResponse check plus logging plus a generic server error response. About **25+ route files** repeat the same catch pattern instead of calling `handleApiError()`, which is redundant and easy to get wrong when adding new routes.

2. **Snapshot strip components** — `PlaceSnapshotsStrip` and `CharacterSnapshotsStrip` are almost identical: same layout (section + title + horizontal scroll), same card styling and drag behavior, same “Drag to Faces or References” copy. Only the data source (place vs character), label field (`placeName` vs `characterName`), and drag-id prefix differ. These can be a single `SnapshotsStrip` (or shared layout + card) parameterized by type.

3. **ActionButton pattern** — Five studio components each define a local `ActionButton` (or equivalent): `youtube-video-card`, `thumbnail-card`, `face-thumbnail`, `palette-thumbnail-card`, `style-thumbnail-card`. They all wrap `ActionBarIcon` + `Button` + `Tooltip` with the same structure; only options like `variant`, `active`, `disabled`, and `iconClassName` differ. Extracting one shared `ActionButton` (e.g. next to `ActionBarIcon`) would remove a lot of repeated JSX and keep behavior consistent.

4. **Grid content-visibility** — `thumbnail-grid`, `style-grid`, and `palette-grid` use the same “above-the-fold” optimization: a memoized item wrapper with `content-visibility: auto` and a threshold (6 for thumbnails/styles, 8 for palettes). The pattern could be a small shared helper or constant to avoid copy-paste when adding new grids.

5. **Clipboard + toast** — Copy-to-clipboard with success/error toasts appears in several places (e.g. referral code, share URL, video title, analytics context). A small `copyToClipboardWithToast(text, successMessage?)` utility would centralize behavior and messaging.

After the refactor, the codebase has less duplication: API error handling, snapshot strips, action buttons, grid visibility, and clipboard+toast are centralized. One **remaining** duplicate pattern is:

- **Browse empty state** — The three browse tabs (`browse-styles`, `browse-thumbnails`, `browse-palettes`) each render the same empty-state UI: a `Card` with `CardContent`, a large muted icon, and a message that switches on `searchQuery` ("No X match your search" vs "No public X available"). Only the icon and copy differ. This can be a small shared `BrowseEmptyState` or `EmptyStateCard` component.

The remaining `if (error instanceof NextResponse)` checks are either inside the shared handlers or in routes that need custom handling first (e.g. YouTube token reauth, or `styles/extract-from-youtube` validation). No further consolidation is required there.

---

## Summary table

| # | Pattern | Severity | Status | Instances | Location | Fix |
|---|--------|----------|--------|-----------|----------|-----|
| 1 | API catch: NextResponse check + serverErrorResponse | ❌ High | ✅ Done | ~25 routes | `app/api/**/*.ts` | Use `handleApiError()` / `handleStorageApiError()` |
| 2 | PlaceSnapshotsStrip / CharacterSnapshotsStrip | ❌ High | ✅ Done | 2 files | `components/studio/*-snapshots-strip.tsx` | Shared `SnapshotsStrip` |
| 3 | ActionButton (Tooltip + ActionBarIcon + Button) | ⚠ Medium | ✅ Done | 5 components | `components/studio/*.tsx` | Shared `ActionButton` in `action-bar-icon.tsx` |
| 4 | Grid content-visibility threshold | ✔ Low | ✅ Done | 3 grids | `style-grid`, `thumbnail-grid`, `palette-grid` | `lib/utils/grid-visibility.ts` |
| 5 | Clipboard write + toast | ✔ Low | ✅ Done | 5+ call sites | studio, referral-modal, share-project-dialog, etc. | `lib/utils/clipboard.ts` |
| 6 | Browse empty state (Card + icon + message) | ✔ Low | 🔲 Pending | 3 files | `browse-styles`, `browse-thumbnails`, `browse-palettes` | Shared `BrowseEmptyState` or `EmptyStateCard` |

---

## Duplicate Pattern #1: API catch block — manual NextResponse check + serverErrorResponse

**Severity**: ❌ High  
**Instances Found**: ~25 route files (30+ catch blocks)

**Locations** (representative):

- `viewbait/app/api/faces/[id]/route.ts` (lines 50–55, 113–117, 183–187)
- `viewbait/app/api/notifications/[id]/route.ts` (lines 137–142)
- `viewbait/app/api/generate/route.ts` (lines 834–838)
- `viewbait/app/api/edit/route.ts` (lines 581–585)
- `viewbait/app/api/analyze-style/route.ts` (lines 196–200)
- `viewbait/app/api/subscriptions/credits/history/route.ts` (lines 82–86)
- `viewbait/app/api/subscriptions/credits/deduct/route.ts` (lines 151–155)
- `viewbait/app/api/styles/[id]/reference-images/route.ts` (lines 79–83, 148–152)
- `viewbait/app/api/referrals/stats/route.ts` (lines 49–53)
- `viewbait/app/api/referrals/create/route.ts` (lines 82–86)
- `viewbait/app/api/referrals/apply/route.ts` (lines 98–102)
- `viewbait/app/api/notifications/mark-all-read/route.ts` (lines 42–46)
- `viewbait/app/api/customer-portal/route.ts` (lines 43–47)
- `viewbait/app/api/create-checkout/route.ts` (lines 72–76)
- `viewbait/app/api/check-subscription/route.ts` (lines 44–48)
- `viewbait/app/api/storage/route.ts` (lines 93–97)
- `viewbait/app/api/storage/list/route.ts` (lines 82–86)
- Plus: `youtube/videos/analyze`, `youtube/videos/[id]/stream`, `youtube/videos/route`, `youtube/channel-videos`, `youtube/videos/analytics`, `thumbnails/analyze-style-for-instructions`, `thumbnails/[id]/project`, and others that use `serverErrorResponse` in catch

**Code sample**:

```ts
} catch (error) {
  // requireAuth throws NextResponse, so check if it's already a response
  if (error instanceof NextResponse) {
    return error
  }
  return serverErrorResponse(error, 'Failed to fetch face')
}
```

**Differences between instances**:

- Only the final message (e.g. `'Failed to fetch face'`, `'Failed to update notification'`) and sometimes `route`/`userId` passed to `serverErrorResponse` differ.
- A few routes use `storageErrorResponse` in the catch (e.g. `storage/route.ts`, `storage/list/route.ts`); those need a variant or a separate helper if you want one call site (e.g. `handleStorageApiError` that forwards to `storageErrorResponse`).

**Recommended fix**:

- Replace the manual `if (error instanceof NextResponse) return error` + `serverErrorResponse(...)` with a single `return handleApiError(error, route, operation, userId, defaultMessage)`.
- For storage routes, either (a) add an optional parameter to `handleApiError` to use `storageErrorResponse` when appropriate, or (b) keep one-line catch that only does `if (error instanceof NextResponse) return error; return handleApiError(...)` and use a thin `handleStorageApiError` that does NextResponse check then `storageErrorResponse`.

**Proposed shared code** (already exists; use it everywhere):

- `handleApiError` in `lib/server/utils/api-helpers.ts` already implements the NextResponse check, logging, and `serverErrorResponse`. Use it in every catch block, e.g.:

```ts
} catch (error) {
  return handleApiError(error, 'GET /api/faces/[id]', 'get-face', undefined, 'Failed to fetch face')
}
```

---

## Duplicate Pattern #2: PlaceSnapshotsStrip and CharacterSnapshotsStrip

**Severity**: ❌ High  
**Instances Found**: 2 files

**Locations**:

- `viewbait/components/studio/place-snapshots-strip.tsx`
- `viewbait/components/studio/character-snapshots-strip.tsx`

**Code sample** (structure is the same; only data/labels differ):

- Section with `aria-label`, `h2` (“Place snapshots” / “Character snapshots”), same helper text, same scroll container with `flex gap-2 overflow-x-auto pb-1 hide-scrollbar`.
- Card: same `cn(...)` for container, same aspect-square image, same truncate label; drag id prefix `place-snapshot-` vs `snapshot-`; `placeName` vs `characterName`; `onViewSnapshot` payload differs by one field.

**Differences**:

- Data: `state.placeSnapshotsByVideoId` vs `state.characterSnapshotsByVideoId`.
- Label: “Place snapshots” vs “Character snapshots”.
- Item: `placeName` / `placeName` vs `characterName` / `characterName`.
- Drag id: `place-snapshot-${videoId}-${index}` vs `snapshot-${videoId}-${index}`.
- `onViewSnapshot` payload: `{ placeName }` vs `{ characterName }` (and type name in DragData).

**Recommended fix**:

- Extract a single `SnapshotsStrip` component that accepts:
  - `variant: 'place' | 'character'`
  - `title: string`
  - `entries`: derived from the appropriate `state.*SnapshotsByVideoId`.
  - A small `SnapshotCard` (or inline render) that takes `videoId`, `index`, `name` (place or character), `imageBlobUrl`, `blob`, and builds the correct `DragData` and `onViewSnapshot` payload from `variant`.

**Proposed shared code** (conceptual):

- One file e.g. `snapshots-strip.tsx` exporting `SnapshotsStrip` with `variant: 'place' | 'character'` and internal `SnapshotCard` that switches on `variant` for drag id prefix and payload.
- `PlaceSnapshotsStrip` and `CharacterSnapshotsStrip` become thin wrappers: `<SnapshotsStrip variant="place" />` and `<SnapshotsStrip variant="character" />` (or pass title/entries from parent if you prefer to keep data source in the parent).

---

## Duplicate Pattern #3: ActionButton (Tooltip + ActionBarIcon + Button)

**Severity**: ⚠ Medium  
**Instances Found**: 5 components

**Locations**:

- `viewbait/components/studio/youtube-video-card.tsx` (lines 72–102)
- `viewbait/components/studio/thumbnail-card.tsx` (lines 268–305)
- `viewbait/components/studio/face-thumbnail.tsx` (lines 75–106)
- `viewbait/components/studio/palette-thumbnail-card.tsx` (lines 43–78)
- `viewbait/components/studio/style-thumbnail-card.tsx` (lines 110–144)

**Code sample** (palette / style — almost identical):

```tsx
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  active = false,
}: { ... }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionBarIcon>
          <Button variant="ghost" size="icon-sm" onClick={onClick}
            className={cn("h-7 w-7 bg-muted/80 hover:bg-muted", variant === "destructive" && "...", active && "text-red-500")}>
            <Icon className={cn("h-4 w-4", active && "fill-red-500")} />
          </Button>
        </ActionBarIcon>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
```

**Differences**:

- `youtube-video-card`: has `disabled`, `iconClassName`; no `variant`/`active`.
- `thumbnail-card`: has `variant`, `active`, `disabled`, `iconClassName`.
- `face-thumbnail`: `active` uses `text-primary` and `fill-primary` instead of red.
- `palette-thumbnail-card` and `style-thumbnail-card`: identical except possibly minor class order.

**Recommended fix**:

- Add a shared `ActionButton` (e.g. in `action-bar-icon.tsx` or `components/studio/action-button.tsx`) with props: `icon`, `label`, `onClick`, `variant?`, `active?`, `disabled?`, `iconClassName?`, and optionally `activeClassName?` (default `text-red-500` / `fill-red-500`; face can pass `text-primary`/`fill-primary`).
- Replace each in-file `ActionButton` with the shared component.

**Proposed shared code** (signature):

- Export from `action-bar-icon.tsx` or new file:

```tsx
export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  active = false,
  disabled = false,
  iconClassName,
  activeClassName = "text-red-500",
  iconActiveClassName = "fill-red-500",
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  active?: boolean;
  disabled?: boolean;
  iconClassName?: string;
  activeClassName?: string;
  iconActiveClassName?: string;
}) { ... }
```

- Use `ActionBarIcon` with `className={cn(disabled && "pointer-events-none opacity-60")}`, Button with variant/destructive/active classes, Icon with `cn("h-4 w-4", iconClassName, active && iconActiveClassName)`.

---

## Duplicate Pattern #4: Grid item + content-visibility threshold

**Severity**: ✔ Low  
**Instances Found**: 3 files

**Locations**:

- `viewbait/components/studio/thumbnail-grid.tsx` (lines 54–67, threshold 6)
- `viewbait/components/studio/style-grid.tsx` (lines 61–74, threshold 6)
- `viewbait/components/studio/palette-grid.tsx` (lines 47–60, threshold 8)

**Code sample**:

- Each has a “MemoizedGridItem” (or similar) that applies `content-visibility: auto` and a class like `cn(index < N && "![content-visibility:visible]")` with N = 6 or 8.

**Differences**:

- Threshold: 6 vs 8.
- Grids render different child types (thumbnail, style, palette cards).

**Recommended fix**:

- Option A: Shared `MemoizedGridItem` in e.g. `components/studio/grid-item.tsx` that takes `index`, `aboveFoldCount` (default 6), and `children`.
- Option B: Constant(s) e.g. `GRID_ABOVE_FOLD_THRESHOLD_DEFAULT = 6`, `GRID_ABOVE_FOLD_THRESHOLD_PALETTE = 8` and a one-line helper `gridItemClassName(index: number, aboveFold: number)` returning the cn result, so at least the rule is in one place.

**Proposed shared code** (minimal):

- In `lib/utils` or next to grids:

```ts
export const GRID_ABOVE_FOLD_DEFAULT = 6
export const GRID_ABOVE_FOLD_PALETTE = 8
export function gridItemAboveFoldClass(index: number, aboveFold: number): string {
  return index < aboveFold ? "![content-visibility:visible]" : ""
}
```

- Then in each grid: `className={cn(gridItemAboveFoldClass(index, GRID_ABOVE_FOLD_DEFAULT))}` (or PALETTE for palette grid).

---

## Duplicate Pattern #5: Clipboard write + toast success/error

**Severity**: ✔ Low  
**Instances Found**: 5+ call sites

**Locations**:

- `viewbait/components/studio/studio-provider.tsx` (copy thumbnail URL)
- `viewbait/components/studio/youtube-video-card.tsx` (copy title)
- `viewbait/components/studio/youtube-video-analytics-modal.tsx` (copy context; has .then/.catch + toast)
- `viewbait/components/studio/share-project-dialog.tsx` (copy share URL)
- `viewbait/components/referral-modal.tsx` (copy referral code)

**Code sample**:

- Mix of `navigator.clipboard.writeText(...).then(() => toast.success(...))` with or without `.catch(() => toast.error(...))`.
- Some use `await navigator.clipboard.writeText(...)` then toast in the same handler.

**Differences**:

- Success messages vary (“Copied!”, “Referral code copied…”, etc.).
- Some have explicit error toasts, some don’t.

**Recommended fix**:

- Add `copyToClipboardWithToast(text: string, successMessage?: string)` in `lib/utils` (or `lib/utils/clipboard.ts`) that:
  - Calls `navigator.clipboard.writeText(text)`.
  - On success: `toast.success(successMessage ?? 'Copied to clipboard')`.
  - On failure: `toast.error('Could not copy to clipboard')`.
- Replace each ad-hoc clipboard + toast block with a call to this helper.

**Proposed shared code**:

```ts
// lib/utils/clipboard.ts or lib/utils.ts
export async function copyToClipboardWithToast(
  text: string,
  successMessage: string = 'Copied to clipboard'
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.error('Could not copy to clipboard')
  }
}
```

- Callers that need different success copy can pass the second argument.

---

## Duplicate Pattern #6: Browse empty state (Card + icon + message)

**Severity**: ✔ Low  
**Instances Found**: 3 files

**Locations**:

- `viewbait/components/studio/browse-styles.tsx` (lines ~158–169)
- `viewbait/components/studio/browse-thumbnails.tsx` (lines ~117–129)
- `viewbait/components/studio/browse-palettes.tsx` (lines ~156–168)

**Code sample**:

```tsx
{!isLoading && items.length === 0 ? (
  <Card>
    <CardContent className="flex flex-col items-center justify-center py-12">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <p className="text-muted-foreground">
        {searchQuery ? "No X match your search" : "No public X available"}
      </p>
    </CardContent>
  </Card>
) : (
  <Grid ... />
)}
```

**Differences**:

- Icon: `Palette` (styles), `ImageIcon` (thumbnails), `Droplets` (palettes).
- Copy: "styles" / "thumbnails" / "palettes" in the two message variants.

**Recommended fix**:

- Add a shared `BrowseEmptyState` (or `EmptyStateCard`) in `components/studio/` or `components/ui/` that accepts `icon: React.ReactNode`, `messageSearch: string`, `messageEmpty: string`, and optional `searchQuery: string` (or render `messageSearch` when `searchQuery` is truthy, else `messageEmpty`). Each browse tab passes its icon and copy and uses the same `Card`/`CardContent` layout.

**Proposed shared code** (conceptual):

- `EmptyStateCard({ icon, message }: { icon: React.ReactNode; message: string })` rendering the Card + CardContent + icon + message. Callers pass `message={searchQuery ? "No X match your search" : "No public X available"}`.

---

## Constraints and notes

- **Do not break existing functionality**: Use same route identifiers and user-facing messages when switching to `handleApiError()`.
- **Type safety**: Keep existing types; shared `ActionButton` and `SnapshotsStrip` should be typed so current usages remain valid.
- **Tests**: Update or add tests for shared helpers (e.g. `copyToClipboardWithToast` mock clipboard; API tests already cover error responses).
- **Intentional isolation**: No duplicate was kept for ownership or semantic reasons; consolidation is appropriate.

---

## Execution options

After review, you can:

1. **Implement all recommended refactorings** (patterns 1–5 are done; pattern 6 = Browse empty state).
2. **Implement specific patterns only** (e.g. pattern 6: shared `EmptyStateCard` for browse tabs).
3. **Generate a detailed report without making changes** (this document serves as that report).
4. **Focus on a specific directory or file pattern** (e.g. only `components/studio/browse-*.tsx` for pattern #6).

If you want to proceed with implementation, specify which option (and which pattern numbers if option 2 or 4).
