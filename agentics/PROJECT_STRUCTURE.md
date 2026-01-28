# ViewBait - Project Structure

## Directory Overview

```
viewbait/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (public)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (app)/                    # Main app route group (protected)
│   │   ├── page.tsx              # Main workspace (single page app)
│   │   └── layout.tsx            # App shell with sidebar
│   ├── api/                      # API routes
│   │   ├── agent/
│   │   ├── generate/
│   │   ├── faces/
│   │   ├── styles/
│   │   ├── thumbnails/
│   │   └── webhooks/
│   ├── actions/                  # Server actions
│   │   ├── auth.ts
│   │   ├── faces.ts
│   │   ├── generation.ts
│   │   ├── styles.ts
│   │   └── agent.ts
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # ALL custom styles
│   └── providers.tsx             # Client providers wrapper
│
├── components/
│   ├── ui/                       # Base components (shadcn + custom)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── avatar.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── popover.tsx
│   │   ├── tooltip.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   ├── badge.tsx
│   │   └── index.ts              # Barrel export
│   │
│   ├── layout/                   # Layout components
│   │   ├── app-shell.tsx         # Main layout wrapper
│   │   ├── sidebar.tsx           # Left sidebar
│   │   ├── mobile-tabs.tsx       # Mobile tab navigation
│   │   └── view-container.tsx    # Responsive view switching
│   │
│   ├── agent/                    # AI Agent components
│   │   ├── chat-container.tsx    # Chat panel wrapper
│   │   ├── message-list.tsx      # Message history display
│   │   ├── message-bubble.tsx    # Individual message
│   │   ├── chat-input.tsx        # User input
│   │   └── thinking-indicator.tsx # Agent processing state
│   │
│   ├── canvas/                   # Canvas/results components
│   │   ├── canvas-container.tsx  # Canvas wrapper
│   │   ├── thumbnail-grid.tsx    # Grid of thumbnails
│   │   ├── thumbnail-card.tsx    # Single thumbnail display
│   │   ├── image-viewer.tsx      # Full-size preview modal
│   │   └── empty-state.tsx       # No thumbnails state
│   │
│   ├── faces/                    # Face management
│   │   ├── face-list.tsx         # List of saved faces
│   │   ├── face-card.tsx         # Single face display
│   │   ├── face-upload.tsx       # Upload new face
│   │   ├── face-selector.tsx     # Face selection UI
│   │   └── face-editor.tsx       # Edit face details
│   │
│   ├── styles/                   # Style management
│   │   ├── style-list.tsx        # List of saved styles
│   │   ├── style-card.tsx        # Single style display
│   │   ├── style-creator.tsx     # Create new style
│   │   ├── style-selector.tsx    # Style selection UI
│   │   └── style-editor.tsx      # Edit style details
│   │
│   └── generation/               # Generation controls
│       ├── generation-settings.tsx  # Settings panel
│       ├── resolution-select.tsx    # Resolution picker
│       ├── aspect-ratio-select.tsx  # Aspect ratio picker
│       └── generate-button.tsx      # Generation trigger
│
├── lib/                          # Utilities and services
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   ├── middleware.ts         # Auth middleware
│   │   └── types.ts              # Database types
│   │
│   ├── gemini/
│   │   ├── client.ts             # Gemini API client
│   │   ├── prompts.ts            # Prompt templates
│   │   └── types.ts              # Gemini types
│   │
│   ├── agent/
│   │   ├── system-prompt.ts      # Agent system prompt
│   │   ├── context-builder.ts    # Build agent context
│   │   ├── action-processor.ts   # Process agent actions
│   │   └── types.ts              # Agent types
│   │
│   ├── images/
│   │   ├── upload.ts             # Image upload utilities
│   │   ├── transform.ts          # Image transformations
│   │   └── urls.ts               # URL generation
│   │
│   └── utils/
│       ├── cn.ts                 # Class name utility
│       └── constants.ts          # App constants
│
├── stores/                       # Zustand stores
│   ├── ui-store.ts               # UI state
│   ├── generation-store.ts       # Generation state
│   ├── agent-store.ts            # Agent/chat state
│   └── index.ts                  # Store exports
│
├── hooks/                        # Custom React hooks
│   ├── use-faces.ts              # Face data hook
│   ├── use-styles.ts             # Style data hook
│   ├── use-thumbnails.ts         # Thumbnail data hook
│   ├── use-agent.ts              # Agent interaction hook
│   ├── use-realtime.ts           # Supabase realtime hook
│   └── use-media-query.ts        # Responsive hook
│
├── types/                        # TypeScript types
│   ├── database.ts               # Supabase generated types
│   ├── api.ts                    # API types
│   └── index.ts                  # Type exports
│
├── public/                       # Static assets
│   ├── logo.svg
│   └── placeholder.svg
│
├── supabase/                     # Supabase configuration
│   ├── migrations/               # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── functions/                # Edge functions (if needed)
│   └── config.toml
│
├── .env.local                    # Environment variables
├── .env.example                  # Example env file
├── next.config.js                # Next.js config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config
├── components.json               # shadcn config
└── package.json
```

## Key Files Explained

### `app/globals.css`

All custom styles live here. This is the single source of truth for styling.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   CSS VARIABLES
   ============================================ */

:root {
  /* Colors */
  --color-background: #0a0a0b;
  --color-surface: #141415;
  --color-surface-elevated: #1c1c1e;
  --color-border: #2a2a2c;
  --color-border-hover: #3a3a3c;
  
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1a1;
  --color-text-tertiary: #6b6b6b;
  
  --color-accent: #ff0000;
  --color-accent-hover: #cc0000;
  --color-accent-muted: #ff000020;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* Animation */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}

/* ============================================
   BASE STYLES
   ============================================ */

body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

/* ============================================
   ANIMATION UTILITIES
   ============================================ */

.animate-fade-in {
  animation: fade-in var(--duration-normal) var(--ease-out);
}

.animate-slide-up {
  animation: slide-up var(--duration-normal) var(--ease-out);
}

.hover-lift {
  transition: transform var(--duration-normal) var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-2px);
}

.press-scale {
  transition: transform var(--duration-fast) var(--ease-out);
}
.press-scale:active {
  transform: scale(0.97);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================
   REDUCED MOTION
   ============================================ */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ============================================
   LAYOUT CLASSES
   ============================================ */

.sidebar {
  width: 240px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.chat-panel {
  width: 360px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.canvas {
  flex: 1;
  background: var(--color-background);
}

/* ============================================
   COMPONENT CLASSES
   ============================================ */

/* Cards */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.card-interactive {
  cursor: pointer;
  transition: border-color var(--duration-normal) var(--ease-out);
}
.card-interactive:hover {
  border-color: var(--color-border-hover);
}

/* Thumbnail cards */
.thumbnail-card {
  aspect-ratio: 16/9;
  overflow: hidden;
  position: relative;
}

.thumbnail-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 60%, rgba(0,0,0,0.8));
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.thumbnail-card:hover .thumbnail-card-overlay {
  opacity: 1;
}

/* Face/Style cards */
.media-card {
  aspect-ratio: 1;
  overflow: hidden;
}

.media-card-selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-muted);
}

/* Messages */
.message-user {
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-sm);
}

.message-assistant {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-sm);
}

/* Buttons */
.btn-primary {
  background: var(--color-accent);
  color: white;
}
.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-ghost {
  background: transparent;
}
.btn-ghost:hover {
  background: var(--color-surface);
}

/* ============================================
   SCROLLBAR
   ============================================ */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}
```

### `app/providers.tsx`

Client-side providers wrapper.

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
```

### `stores/ui-store.ts`

UI state management.

```typescript
import { create } from 'zustand';

type SidebarTab = 'navigation' | 'faces' | 'styles';
type MobileView = 'sidebar' | 'chat' | 'canvas';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  activeSidebarTab: SidebarTab;
  
  // Mobile
  mobileView: MobileView;
  
  // Panels (agent can control)
  faceSelectorOpen: boolean;
  styleSelectorOpen: boolean;
  settingsOpen: boolean;
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setMobileView: (view: MobileView) => void;
  showPanel: (panel: string) => void;
  hidePanel: (panel: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeSidebarTab: 'navigation',
  mobileView: 'canvas',
  faceSelectorOpen: false,
  styleSelectorOpen: false,
  settingsOpen: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ activeSidebarTab: tab }),
  setMobileView: (view) => set({ mobileView: view }),
  
  showPanel: (panel) => {
    switch (panel) {
      case 'faces':
        set({ faceSelectorOpen: true, activeSidebarTab: 'faces' });
        break;
      case 'styles':
        set({ styleSelectorOpen: true, activeSidebarTab: 'styles' });
        break;
      case 'settings':
        set({ settingsOpen: true });
        break;
    }
  },
  
  hidePanel: (panel) => {
    switch (panel) {
      case 'faces':
        set({ faceSelectorOpen: false });
        break;
      case 'styles':
        set({ styleSelectorOpen: false });
        break;
      case 'settings':
        set({ settingsOpen: false });
        break;
    }
  },
}));
```

### `stores/generation-store.ts`

Generation state management.

```typescript
import { create } from 'zustand';
import type { AspectRatio, Resolution, Thumbnail } from '@/types';

interface GenerationState {
  // Selection
  selectedFaceIds: string[];
  selectedStyleId: string | null;
  prompt: string;
  
  // Settings
  aspectRatio: AspectRatio;
  resolution: Resolution;
  
  // Status
  isGenerating: boolean;
  generationProgress: number;
  
  // Results
  thumbnails: Thumbnail[];
  
  // Actions
  setPrompt: (prompt: string) => void;
  addFace: (faceId: string) => void;
  removeFace: (faceId: string) => void;
  setFaces: (faceIds: string[]) => void;
  setStyle: (styleId: string | null) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setResolution: (resolution: Resolution) => void;
  setGenerating: (isGenerating: boolean, progress?: number) => void;
  addThumbnail: (thumbnail: Thumbnail) => void;
  updateThumbnail: (id: string, updates: Partial<Thumbnail>) => void;
  reset: () => void;
}

const initialState = {
  selectedFaceIds: [],
  selectedStyleId: null,
  prompt: '',
  aspectRatio: '16:9' as AspectRatio,
  resolution: '2k' as Resolution,
  isGenerating: false,
  generationProgress: 0,
  thumbnails: [],
};

export const useGenerationStore = create<GenerationState>((set) => ({
  ...initialState,

  setPrompt: (prompt) => set({ prompt }),
  
  addFace: (faceId) => set((state) => ({
    selectedFaceIds: state.selectedFaceIds.includes(faceId)
      ? state.selectedFaceIds
      : [...state.selectedFaceIds, faceId],
  })),
  
  removeFace: (faceId) => set((state) => ({
    selectedFaceIds: state.selectedFaceIds.filter((id) => id !== faceId),
  })),
  
  setFaces: (faceIds) => set({ selectedFaceIds: faceIds }),
  
  setStyle: (styleId) => set({ selectedStyleId: styleId }),
  
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  
  setResolution: (resolution) => set({ resolution }),
  
  setGenerating: (isGenerating, progress = 0) => 
    set({ isGenerating, generationProgress: progress }),
  
  addThumbnail: (thumbnail) => set((state) => ({
    thumbnails: [thumbnail, ...state.thumbnails],
  })),
  
  updateThumbnail: (id, updates) => set((state) => ({
    thumbnails: state.thumbnails.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    ),
  })),
  
  reset: () => set(initialState),
}));
```

### `components/layout/app-shell.tsx`

Main layout component.

```tsx
'use client';

import { useUIStore } from '@/stores/ui-store';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Sidebar } from './sidebar';
import { MobileTabs } from './mobile-tabs';
import { cn } from '@/lib/utils/cn';

interface AppShellProps {
  chat: React.ReactNode;
  canvas: React.ReactNode;
}

export function AppShell({ chat, canvas }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { mobileView } = useUIStore();

  if (isDesktop) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="chat-panel flex flex-col">{chat}</div>
        <div className="canvas flex flex-col">{canvas}</div>
      </div>
    );
  }

  // Mobile: tabbed interface
  return (
    <div className="flex flex-col h-screen">
      <MobileTabs />
      <div className="flex-1 overflow-hidden">
        <div className={cn('h-full', mobileView !== 'sidebar' && 'hidden')}>
          <Sidebar />
        </div>
        <div className={cn('h-full', mobileView !== 'chat' && 'hidden')}>
          {chat}
        </div>
        <div className={cn('h-full', mobileView !== 'canvas' && 'hidden')}>
          {canvas}
        </div>
      </div>
    </div>
  );
}
```

## Component Guidelines

### 1. Always Use Base Components

```tsx
// ❌ Don't create one-off components
function MySpecialButton({ children }) {
  return (
    <button className="bg-red-500 px-4 py-2 rounded-lg">
      {children}
    </button>
  );
}

// ✅ Use and compose base components
import { Button } from '@/components/ui/button';

function GenerateButton() {
  return (
    <Button variant="primary" className="press-scale">
      Generate
    </Button>
  );
}
```

### 2. Style Through globals.css

```tsx
// ❌ Don't add inline Tailwind for reusable patterns
<div className="bg-[#141415] border border-[#2a2a2c] rounded-lg">

// ✅ Use classes from globals.css
<div className="card">
```

### 3. Compose, Don't Extend

```tsx
// ❌ Don't add props for every variation
<Card variant="thumbnail" size="large" hasOverlay />

// ✅ Compose with className
<Card className="thumbnail-card">
  <img src={url} alt={alt} />
  <div className="thumbnail-card-overlay">
    {/* Actions */}
  </div>
</Card>
```

### 4. Use Consistent Animation Classes

```tsx
// Apply from globals.css
<div className="animate-fade-in">
  <Card className="hover-lift">
    <Button className="press-scale">Click</Button>
  </Card>
</div>
```

## Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Gemini
GEMINI_API_KEY=your-gemini-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "supabase gen types typescript --project-id your-project > types/database.ts",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset"
  }
}
```
