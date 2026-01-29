# Button Audit — Application-Wide Button Types and Variants

This document captures all buttons, button types, and button variants used across the Viewbait application. **All in-app buttons use the shared `Button` component from `@/components/ui/button.tsx`** (or wrappers that delegate to it), so styling is controlled from a central system.

---

## 1. Central Button System

**Source:** `@/components/ui/button.tsx`

The app uses a single primary Button component built with **class-variance-authority (CVA)**. All styling is defined in `buttonVariants`.

### 1.1 Variants (visual style)

| Variant       | Usage in app |
|---------------|--------------|
| **default**   | Primary CTAs: auth submit, landing "Get Started" / "Start Creating", generate button, "View plans", subscription tier (selected), not-found links, aspect ratio / resolution / variations toggles when selected |
| **outline**   | Secondary actions: "Learn More", dialog "Close", "Try Again" (error states), "Cancel" (modals), Add view/cell, refresh, load more, mobile nav actions, browse controls, drop zones (with `asChild`) |
| **secondary** | Style card "Use style", palette-editor cancel, style-editor cancel, subscription modal (current tier) |
| **ghost**     | Icon-only and low-emphasis: menu, user, sign out, referral, theme toggle, notification bell, sidebar collapse, card overflow actions, chat "Reset", "Dismiss", pagination (inactive), calendar day cell, combobox clear, nav items, notification list rows (with `asChild`). CloseButton uses **default** (primary). |
| **destructive** | Delete actions: thumbnail delete, palette delete, style delete, face delete, delete-confirmation primary action |
| **link**      | Forgot password, "Create your first style", "Manage all styles", "Add a palette", "Manage palettes", "Add your first face" (inline link-style actions) |

**Ghost and secondary hover:** On hover, text and icon (and any content inside the button) use the **primary** color (`hover:text-primary`, `hover:[&_svg]:text-primary`).

### 1.2 Sizes

| Size       | Usage in app |
|------------|--------------|
| **default** | Pagination prev/next (via PaginationLink), AlertDialog default |
| **xs**      | Not used on `<Button>` directly; InputGroupButton uses its own size system (see below) |
| **sm**      | Style card "Use style", chat suggestion chips, palette-editor ghost, view-controls, notification popover trigger, dynamic-ui-renderer, style-editor |
| **lg**      | Auth submit buttons, landing CTAs, generate button, not-found |
| **icon**    | Send (chat), calendar day cell, view-controls icon buttons, style-card / face-card overflow, notification-item, browse-controls, theme-toggle (when not icon-sm), combobox chip remove |
| **icon-xs** | Combobox clear button, InputGroupButton in combobox |
| **icon-sm** | CloseButton (primary variant), sidebar icons (referral, sign out, collapse), thumbnail/palette/style/face card actions, studio-generator mode toggle, notification bell, theme toggle, sidebar trigger |
| **icon-lg**  | Mobile floating nav actions, studio-settings-sidebar icons, referral modal close |

### 1.3 HTML button types

| Type       | Where used |
|------------|-------------|
| **submit** | Auth forms (login, signup, forgot-password submit, reset-password) |
| **button** | All other buttons (default when omitted on `<Button>`) |

---

## 2. Button-Related Components

### 2.1 CloseButton (`@/components/ui/close-button.tsx`)

- Wraps `Button` with fixed props: `type="button"`, `variant="default"` (primary), `size="icon-sm"`, `aria-label="Close"`.
- Used in: modal, dialog, sheet, studio chat. Primary variant for prominence.

### 2.2 FloatingButton (`@/components/ui/floating-button.tsx`)

- **Not** a Button variant. FAB pattern built with Framer Motion (`motion.div` / `motion.ul`). Callers pass `Button` as `triggerContent` and as `FloatingButtonItem` children so all FAB triggers use the shared Button styling.

### 2.3 ButtonGroup (`@/components/ui/button-group.tsx`)

- Layout wrapper only (`role="group"`). Children are regular `Button` components. No variant/size of its own.

### 2.4 InputGroupButton (`@/components/ui/input-group.tsx`)

- Wraps `Button` and applies its own CVA `inputGroupButtonVariants` for **size** (xs, sm, icon-xs, icon-sm). **Variant** is passed through to `Button` (e.g. `variant="ghost"`).
- Used in: combobox clear and chip remove. Sizes used: `icon-xs`, `ghost`.

### 2.5 AlertDialog Action/Cancel (`@/components/ui/alert-dialog.tsx`)

- `AlertDialogAction`: uses `Button` with `variant`/`size` props (default: `variant="default"`, `size="default"`).
- `AlertDialogCancel`: uses `Button` with default `variant="outline"`, `size="default"`.

### 2.6 Tabs — primary segment look (`@/components/ui/tabs.tsx`)

- **TabsTrigger** has CVA `tabsTriggerVariants` with **variant** (`default` | `primary`) and **size** (`default` | `compact` | `lg`).
- The **primary** look (active: `bg-primary` / `text-primary-foreground`, inactive: `bg-muted` / `text-muted-foreground` with hover) is defined by `variant="primary"`. Use this for segment-style tabs so the app stays consistent.
- **Sizes:** `compact` for small panels (e.g. notification popover: Unread / All / Archived); `lg` for full panels (e.g. Browse: Thumbnails / Styles / Palettes; Results / Settings).
- Used in: notification-popover, studio-frame (mobile Results/Settings), studio-views (Browse tabs).

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

## 4. Migration status (completed)

- **Raw `<button>` elements** have been replaced with `<Button>` across: auth page (forgot password), studio-sidebar (nav items, credits, collapse), studio-generator (mode tabs, add cell, style/palette/face links and grids), thinking-message, view-controls (clear search), studio-mobile-floating-nav (credits, nav items), studio-settings-sidebar, palette-editor, palette-card-manage, face-editor, face-card, style-editor.

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

## 5. Summary: Single Source of Truth

| Concern | Current state |
|--------|----------------|
| **Primary component** | `@/components/ui/button.tsx` — CVA variants and sizes |
| **Variants used** | default, outline, secondary, ghost, destructive, link |
| **Sizes used** | default, sm, lg, icon, icon-xs, icon-sm, icon-lg. **xs** only via InputGroupButton |
| **HTML types** | `submit` on form submit buttons; `button` everywhere else |
| **Ghost/secondary hover** | Text and icon use primary color on hover |

### Central system in place

1. **Single source:** `button.tsx` and `buttonVariants` control all button styling.
2. **Wrappers:** CloseButton, InputGroupButton, and AlertDialog Action/Cancel delegate to `Button`; FloatingButton callers pass `Button` as trigger and items.
3. **Drop zones / custom markup:** `Button asChild` wraps divs that need drag-drop or custom layout while keeping Button styling and semantics.
4. **link variant:** Used for inline link-style actions (forgot password, "Create your first style", "Manage all styles", etc.).
’s consistent.

---

*Last updated: after centralizing all buttons on `Button` and adding ghost/secondary hover (primary color).*
