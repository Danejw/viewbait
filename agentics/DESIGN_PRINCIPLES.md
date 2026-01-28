# ViewBait - Design Principles

## Design Identity

ViewBait is a **creator-focused** tool that feels **clean**, **approachable**, and **efficient**. The interface should disappear so creators can focus on their thumbnails.

## Visual Foundation

### Color System

```css
/* Base Palette - Neutral Dark */
--color-background: #0a0a0b;        /* Deep black background */
--color-surface: #141415;           /* Card/panel backgrounds */
--color-surface-elevated: #1c1c1e;  /* Modals, dropdowns */
--color-border: #2a2a2c;            /* Subtle borders */
--color-border-hover: #3a3a3c;      /* Interactive borders */

/* Text Hierarchy */
--color-text-primary: #fafafa;      /* Primary text */
--color-text-secondary: #a1a1a1;    /* Secondary/muted text */
--color-text-tertiary: #6b6b6b;     /* Disabled/placeholder */

/* Accent - YouTube Red */
--color-accent: #ff0000;            /* Primary accent */
--color-accent-hover: #cc0000;      /* Hover state */
--color-accent-muted: #ff000020;    /* Subtle backgrounds */

/* Semantic Colors */
--color-success: #22c55e;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
```

### Typography

**Font Family**: Inter (with system fallbacks)

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Scale**:
- `text-xs`: 12px - Captions, badges
- `text-sm`: 14px - Secondary text, labels
- `text-base`: 16px - Body text, inputs
- `text-lg`: 18px - Emphasized body
- `text-xl`: 20px - Section headers
- `text-2xl`: 24px - Page headers
- `text-3xl`: 30px - Hero text (rare)

**Weights**:
- 400 (regular) - Body text
- 500 (medium) - Labels, buttons
- 600 (semibold) - Headers, emphasis

### Spacing

Use a 4px base unit. Common values:
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-6`: 24px
- `space-8`: 32px
- `space-12`: 48px

### Border Radius

**Rounded** shape language (not sharp, not super-rounded):

```css
--radius-sm: 6px;   /* Small elements: badges, chips */
--radius-md: 8px;   /* Buttons, inputs, cards */
--radius-lg: 12px;  /* Panels, modals */
--radius-xl: 16px;  /* Large containers */
```

### Shadows

Minimal shadows. Use borders and background contrast instead.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
```

## Animation Principles

Animation is fundamental to the experience. Every interactive element should respond.

### Timing

```css
--duration-fast: 100ms;    /* Micro-interactions */
--duration-normal: 200ms;  /* Standard transitions */
--duration-slow: 300ms;    /* Panel slides, reveals */
--duration-slower: 500ms;  /* Page transitions */
```

### Easing

```css
--ease-out: cubic-bezier(0.33, 1, 0.68, 1);      /* Entering elements */
--ease-in: cubic-bezier(0.32, 0, 0.67, 0);       /* Exiting elements */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* Moving elements */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy feel */
```

### Standard Animations

Define these in `globals.css` and reuse everywhere:

```css
/* Hover lift for cards */
.hover-lift {
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Button press */
.press-scale {
  transition: transform var(--duration-fast) var(--ease-out);
}
.press-scale:active {
  transform: scale(0.97);
}

/* Fade in */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale in */
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

### Reduced Motion Support

Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Component Philosophy

### The Golden Rule

**Never create one-off components.**

Every component must be:
1. Defined in the component library
2. Styled through `globals.css` or Tailwind utilities
3. Reusable across the entire application

### Base Component Set

These are the ONLY components we build from. Everything composes from these:

**Layout**
- `Container` - Max-width wrapper with padding
- `Stack` - Vertical flex container
- `Row` - Horizontal flex container
- `Grid` - CSS Grid wrapper

**Inputs**
- `Button` - All button variants
- `Input` - Text input
- `Textarea` - Multi-line input
- `Select` - Dropdown selection
- `Checkbox` - Boolean toggle
- `Switch` - Toggle switch
- `Slider` - Range input

**Display**
- `Card` - Content container
- `Badge` - Status indicators
- `Avatar` - User/face images
- `Thumbnail` - Generated image display
- `Skeleton` - Loading placeholder

**Feedback**
- `Toast` - Notifications
- `Dialog` - Modal dialogs
- `Popover` - Contextual overlays
- `Tooltip` - Hover hints

**Navigation**
- `Tabs` - Tab switching (critical for mobile)
- `Sidebar` - Left navigation panel
- `IconButton` - Icon-only buttons

### Composition Over Customization

Instead of adding props for every variation, compose base components:

```tsx
// ❌ Don't do this
<Button variant="thumbnail-download" size="card-action" icon="download" />

// ✅ Do this
<Card className="thumbnail-card">
  <ThumbnailImage src={url} />
  <Row className="thumbnail-actions">
    <IconButton icon={Download} />
    <IconButton icon={Edit} />
  </Row>
</Card>
```

## Layout System

### The Three-Column Pattern

```
┌─────────────┬─────────────────────┬─────────────────────────┐
│             │                     │                         │
│  SIDEBAR    │    CHAT/SETTINGS    │        CANVAS           │
│  (nav)      │    (interaction)    │        (results)        │
│             │                     │                         │
│  240px      │    360px            │        flex-1           │
│  fixed      │    fixed            │        fluid            │
│             │                     │                         │
└─────────────┴─────────────────────┴─────────────────────────┘
```

### Mobile Adaptation

On mobile, collapse to tabbed interface:

```
┌─────────────────────────────────────┐
│  [Sidebar] [Chat] [Canvas]  ← Tabs  │
├─────────────────────────────────────┤
│                                     │
│         Active Tab Content          │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

The mental model stays the same. Users just tap to switch context.

### Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
```

Desktop layout activates at `lg` (1024px).

## Voice and Copy

### Tone: Friendly with Wit

The AI agent should feel like a capable friend who happens to be great at thumbnails.

**Do:**
- "Let's make something that stops the scroll"
- "Looking good! Want me to try a few more angles?"
- "I grabbed your usual style. Ready to generate?"

**Don't:**
- "Please select your preferred thumbnail parameters"
- "Generation complete. Output saved to gallery."
- "Error: Invalid face reference ID"

### Microcopy Guidelines

- **Buttons**: Action verbs. "Generate", "Save Style", "Upload Face"
- **Labels**: Clear nouns. "Your Faces", "Saved Styles", "Recent"
- **Empty States**: Helpful, not apologetic. "No faces yet. Upload one to get started."
- **Errors**: Specific and actionable. "That image is too small. Try one at least 512x512."
- **Loading**: Engaging. "Cooking up your thumbnail..." not "Loading..."

## Accessibility

### Minimum Requirements

1. **Color contrast**: 4.5:1 for text, 3:1 for large text
2. **Focus indicators**: Visible on all interactive elements
3. **Keyboard navigation**: Full app usable without mouse
4. **Screen reader labels**: All images and icons have alt text
5. **Reduced motion**: Respect `prefers-reduced-motion`

### Focus Styles

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

## Anti-Patterns (Hard Don'ts)

1. **No one-off components** - If you need it once, you'll need it again
2. **No inline styles** - Everything through globals.css or Tailwind
3. **No gradients on UI chrome** - Save visual punch for thumbnails
4. **No heavy drop shadows** - Feels dated
5. **No white/bright backgrounds** - Would wash out thumbnail previews
6. **No emojis in UI copy** - Keep it professional
7. **No skeleton loaders everywhere** - Use purposeful loading states
8. **No custom scrollbars** - Use native with subtle styling
9. **No tooltips on mobile** - They don't work; use labels instead
10. **No confirmation dialogs for reversible actions** - Use undo instead

## File Organization

```
src/
├── styles/
│   └── globals.css          # ALL custom styles live here
├── components/
│   └── ui/                   # shadcn components + our base components
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── features/                 # Feature-specific compositions
│   ├── canvas/
│   ├── chat/
│   ├── faces/
│   └── styles/
└── app/
    └── ...
```

## Checklist for New Features

Before shipping any new UI:

- [ ] Uses only base components
- [ ] Styles defined in globals.css
- [ ] Works at all breakpoints
- [ ] Keyboard accessible
- [ ] Has loading state
- [ ] Has error state
- [ ] Has empty state
- [ ] Animations respect reduced-motion
- [ ] Copy reviewed for tone
