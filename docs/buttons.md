# Button Audit — Application-Wide Button Types and Variants

This document captures all buttons, button types, and button variants used across the Viewbait application so styling can be controlled from a central system.

---

## 1. Central Button System

**Source:** `@/components/ui/button.tsx`

The app uses a single primary Button component built with **class-variance-authority (CVA)**. All styling is defined in `buttonVariants`.

### 1.1 Variants (visual style)

| Variant       | Usage in app |
|---------------|--------------|
| **default**   | Primary CTAs: auth submit, landing "Get Started" / "Start Creating", generate button, "View plans", subscription tier (selected), not-found links, aspect ratio / resolution / variations toggles when selected |
| **outline**   | Secondary actions: "Learn More", dialog "Close", "Try Again" (error states), "Cancel" (modals), Add view/cell, refresh, load more, mobile nav actions, browse controls |
| **secondary** | Style card "Use style", palette-editor cancel, style-editor cancel, subscription modal (current tier) |
| **ghost**     | Icon-only and low-emphasis: CloseButton, menu, user, sign out, referral, theme toggle, notification bell, sidebar collapse, card overflow actions, chat "Reset", "Dismiss", pagination (inactive), calendar day cell, combobox clear |
| **destructive** | Delete actions: thumbnail delete, palette delete, style delete, face delete, delete-confirmation primary action |
| **link**      | Defined in `button.tsx` but **not used** anywhere in the codebase |

### 1.2 Sizes

| Size       | Usage in app |
|------------|--------------|
| **default** | Pagination prev/next (via PaginationLink), AlertDialog default |
| **xs**      | Not used on `<Button>` directly; InputGroupButton uses its own size system (see below) |
| **sm**      | Style card "Use style", chat suggestion chips, palette-editor ghost, view-controls, notification popover trigger, dynamic-ui-renderer, style-editor |
| **lg**      | Auth submit buttons, landing CTAs, generate button, not-found |
| **icon**    | Send (chat), calendar day cell, view-controls icon buttons, style-card / face-card overflow, notification-item, browse-controls, theme-toggle (when not icon-sm), combobox chip remove |
| **icon-xs** | Combobox clear button, InputGroupButton in combobox |
| **icon-sm** | CloseButton, sidebar icons (referral, sign out, collapse), thumbnail/palette/style/face card actions, studio-generator mode toggle, notification bell, theme toggle, sidebar trigger |
| **icon-lg**  | Mobile floating nav actions, studio-settings-sidebar icons, referral modal close |

### 1.3 HTML button types

| Type       | Where used |
|------------|-------------|
| **submit** | Auth forms (login, signup, forgot-password submit, reset-password via BaseButton) |
| **button** | All other buttons (default when omitted on `<Button>`) |

---

## 2. Button-Related Components

### 2.1 CloseButton (`@/components/ui/close-button.tsx`)

- Wraps `Button` with fixed props: `type="button"`, `variant="ghost"`, `size="icon-sm"`, `aria-label="Close"`.
- Used in: modal, dialog, sheet.

### 2.2 FloatingButton (`@/components/ui/floating-button.tsx`)

- **Not** a Button variant. FAB pattern built with Framer Motion (`motion.div` / `motion.ul`). Trigger and items are custom-styled; no use of `Button` or `buttonVariants`.

### 2.3 ButtonGroup (`@/components/ui/button-group.tsx`)

- Layout wrapper only (`role="group"`). Children are regular `Button` components. No variant/size of its own.

### 2.4 InputGroupButton (`@/components/ui/input-group.tsx`)

- Wraps `Button` and applies its own CVA `inputGroupButtonVariants` for **size** (xs, sm, icon-xs, icon-sm). **Variant** is passed through to `Button` (e.g. `variant="ghost"`).
- Used in: combobox clear and chip remove. Sizes used: `icon-xs`, `ghost`.

### 2.5 AlertDialog Action/Cancel (`@/components/ui/alert-dialog.tsx`)

- `AlertDialogAction`: uses `Button` with `variant`/`size` props (default: `variant="default"`, `size="default"`).
- `AlertDialogCancel`: uses `Button` with default `variant="outline"`, `size="default"`.

---

## 3. Other Components That Use Button

| Component              | Button usage |
|------------------------|--------------|
| **NotificationBell**  | `variant="ghost"`, `size` from prop (default `icon-sm`) |
| **ThemeToggle**       | `variant="ghost"`, `size` from prop (default `icon-sm`) |
| **SidebarTrigger**    | `variant="ghost"`, `size="icon-sm"` |
| **Pagination**        | `PaginationLink`: `variant="ghost"` or `outline` when active, `size="default"` for prev/next |
| **Calendar** (day cell) | `variant="ghost"`, `size="icon"` |

---

## 4. Raw `<button>` Elements (Not Using Button Component)

These are native `<button>` elements with custom `className`s. Replacing them with `Button` would centralize styling.

| File | Purpose |
|------|---------|
| `app/auth/page.tsx` | Forgot password trigger |
| `components/studio/studio-sidebar.tsx` | View nav items, “open referral” area, sidebar collapse trigger |
| `components/studio/studio-generator.tsx` | Mode toggle (manual/chat), add cell, quick create, style/palette list items, add face |
| `components/studio/thinking-message.tsx` | Expand/collapse |
| `components/studio/view-controls.tsx` | Clear search |
| `components/studio/studio-mobile-floating-nav.tsx` | Subscription trigger, view nav items |
| `components/studio/studio-settings-sidebar.tsx` | Toggle right sidebar |
| `components/studio/palette-editor.tsx` | Edit start, delete color, add color, clear |
| `components/studio/palette-card-manage.tsx` | Card click target |
| `components/studio/face-editor.tsx` | Remove face |
| `components/studio/face-card.tsx` | Card click target |
| `components/studio/style-editor.tsx` | Custom trigger (e.g. open) |

Some clickable areas use `role="button"` on non-button elements (e.g. `studio-generator.tsx`, `palette-editor.tsx`, `face-editor.tsx`, `notification-item.tsx`, `face-thumbnail.tsx`, `style-editor.tsx`, `gallery-controls.tsx`). These could be switched to `<Button>` or `<button>` for semantics and consistent styling.

---

## 5. Alternative Button System (Reset Password)

**File:** `app/auth/reset-password/page.tsx`

- Uses **BaseButton** from `@/app/components/BaseButton` with `variant="primary"` and `size="md"`.
- `Button` from `@/components/ui/button.tsx` does **not** have `variant="primary"` or `size="md"` (it has `default` and `lg`/`sm`/etc.).
- **Recommendation:** Either migrate this page to `Button` (e.g. `variant="default"` and `size="lg"` to match other auth pages) or document BaseButton as a separate system and map its variants to the central one.

---

## 6. Summary: Single Source of Truth

| Concern | Current state |
|--------|----------------|
| **Primary component** | `@/components/ui/button.tsx` — CVA variants and sizes |
| **Variants used** | default, outline, secondary, ghost, destructive. **link** exists but unused |
| **Sizes used** | default, sm, lg, icon, icon-xs, icon-sm, icon-lg. **xs** only via InputGroupButton |
| **HTML types** | `submit` on form submit buttons; `button` everywhere else |
| **Gaps** | (1) Many raw `<button>` and `role="button"` elements; (2) BaseButton on reset-password with different variant/size names; (3) InputGroupButton has its own size scale |

### Recommendations for a central system

1. **Keep** `button.tsx` and `buttonVariants` as the single source of truth for primary/secondary/ghost/destructive and sizes.
2. **Replace** raw `<button>` and appropriate `role="button"` elements with `<Button>` and the right variant/size so all interactive buttons go through the same styles.
3. **Align** reset-password with the rest of the app: use `Button` with `variant="default"` and `size="lg"` (or add `primary`/`md` to the central Button if you want to keep those names).
4. **Document** CloseButton, InputGroupButton, and AlertDialog Action/Cancel as wrappers that delegate to `Button` and list their default variant/size in this doc.
5. **Optionally** remove or repurpose the unused `link` variant, or start using it for text-link-style actions so it’s consistent.

---

*Last audited: application-wide grep and file review of `viewbait` (Button, CloseButton, FloatingButton, ButtonGroup, InputGroupButton, AlertDialog, raw buttons, BaseButton).*
