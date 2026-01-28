# ViewBait - Product Vision

## What is ViewBait?

ViewBait is an AI-powered thumbnail generator that helps content creators produce scroll-stopping thumbnails through conversational AI assistance. Users describe what they want, and an intelligent agent helps them create, refine, and iterate on thumbnails using their saved faces and styles.

## Core Value Proposition

**For YouTube creators and content producers** who need high-converting thumbnails but lack design skills or time, ViewBait provides an AI-first workflow where you describe your vision and the system generates professional thumbnails featuring your face (or multiple faces) in your preferred style.

## The Problem

1. **Thumbnail creation is time-consuming** - Creators spend hours in Photoshop or Canva tweaking designs
2. **Consistency is hard** - Maintaining brand style across videos requires discipline and skill
3. **Face placement is tedious** - Adding yourself to thumbnails means masking, compositing, and color matching
4. **Iteration is slow** - Testing different concepts means starting from scratch each time

## The Solution

ViewBait solves this through:

1. **Conversational Generation** - Describe what you want in natural language
2. **Face Library** - Upload reference photos once, use them in any thumbnail
3. **Style Memory** - Save and reuse visual styles that define your brand
4. **Batch Generation** - Create multiple variations in one request
5. **AI Guidance** - An agent that helps you through every step, surfacing the right tools at the right time

## Product Principles

### 1. Conversation First
The AI agent is not a sidebar feature - it IS the interface. Users should feel like they're working with a capable collaborator who understands thumbnails, not clicking through menus.

### 2. Left-to-Right Flow
Information flows naturally: Navigation (left) → Chat/Settings (center) → Canvas/Results (right). This mirrors how creators think: decide what to do, configure it, see results.

### 3. Consistency Through Constraint
We use a small set of base components everywhere. This creates muscle memory and reduces cognitive load. Users should never wonder "how does this part work?"

### 4. Mobile Parity
The same experience on phone and desktop. Mobile collapses to tabs but maintains the same mental model. Creators check results on their phones constantly.

### 5. Speed Over Perfection
Generate fast, iterate faster. Show results quickly even if refinement takes longer. Creators want to see if they're on the right track.

## User Journey

### First Time User
1. Signs up, immediately sees clean canvas with welcome message from agent
2. Agent asks about their content type and style preferences
3. User uploads a face reference photo
4. Agent guides them through first thumbnail generation
5. User saves their first style, sees how to reuse it

### Returning User
1. Opens app, sees recent thumbnails grid
2. Types "Make a reaction thumbnail for my new gaming video"
3. Agent selects their default face and preferred style
4. Generates 4 variations in the canvas
5. User picks favorite, requests minor tweaks through chat
6. Downloads final thumbnail

### Power User
1. Has 5 saved faces (self, co-host, guests)
2. Has 3 saved styles (reaction, tutorial, vlog)
3. Uses quick commands: "Reaction style, both faces, shocked expression"
4. Generates 8 variations, picks 2 for A/B testing
5. Saves new style variation for future use

## Key Features

### Face Library
- Upload multiple reference photos per person
- System learns facial features for consistent generation
- Select one or multiple faces per thumbnail
- Position hints (left, right, center, custom)

### Style System
- Save successful thumbnails as style references
- Capture: color palette, text treatment, composition, mood
- Apply saved styles to new generations
- Mix styles for variations

### AI Agent Capabilities
- Understands thumbnail best practices (contrast, faces, text placement)
- Suggests improvements based on click-through research
- Remembers user preferences and past conversations
- Can show/hide UI panels based on conversation context
- Surfaces relevant faces and styles proactively

### Generation Options
- Resolutions: 1K, 2K, 4K
- Aspect ratios: 16:9 (YouTube), 1:1 (Instagram), 9:16 (Shorts/TikTok), 2:3, custom
- Batch sizes: 1, 4, 8 variations
- Refinement: Inpainting for specific areas

## Success Metrics

1. **Time to First Thumbnail** - Under 2 minutes for new users
2. **Thumbnails per Session** - Average 5+ generations
3. **Style Reuse Rate** - 60%+ of generations use saved styles
4. **Return Rate** - 70% weekly active from monthly active
5. **NPS** - 50+ among active users

## Technical Foundation

- **Frontend**: Next.js (App Router), React, Zustand, shadcn/ui
- **Backend**: Supabase (Auth, Database, Storage)
- **AI**: Gemini API for image generation
- **Architecture**: Server-side generation, edge-optimized delivery

## What ViewBait is NOT

- Not a general-purpose image editor (use Photoshop for that)
- Not a template library (we generate, not fill in blanks)
- Not a stock photo site (we create original compositions)
- Not a face-swapping app (we generate faces in context, not swap existing ones)

## Future Vision

Phase 1 (MVP): Core generation with faces and styles
Phase 2: A/B testing integration with YouTube analytics
Phase 3: Automatic thumbnail generation from video content
Phase 4: Team collaboration and brand guidelines enforcement
