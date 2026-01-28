# ViewBait — Product Brief

## Product Overview

**ViewBait** is an AI-powered web application that helps YouTube creators generate high-quality, click-worthy thumbnails in seconds. The platform combines advanced AI image generation with creator-focused features like face integration, style presets, and title optimization to streamline the thumbnail creation workflow.

---

## Target Audience

### Primary Users
- **YouTube Creators** (all sizes, from hobbyists to full-time creators)
- **Content Marketing Teams** producing video content
- **Social Media Managers** who need consistent visual assets
- **Course Creators & Educators** publishing video lessons

### User Pain Points Addressed
1. **Time-consuming design process** — Manual thumbnail creation in Photoshop takes 30-60 minutes
2. **Lack of design skills** — Not all creators are designers
3. **Inconsistent branding** — Hard to maintain visual consistency across videos
4. **A/B testing friction** — Generating variations for testing is tedious
5. **Face integration challenges** — Getting the creator's face to look natural is difficult

---

## Core Features

### 1. AI Thumbnail Generation
The heart of the product. Users input:
- **Video Title/Topic** — What the video is about
- **Thumbnail Text** — Optional overlay text for the thumbnail
- **Style Selection** — Pre-built or custom visual styles
- **Color Palette** — Curated or custom color schemes
- **Aspect Ratio** — 16:9 (YouTube), 1:1 (shorts), 9:16 (vertical)
- **Resolution** — 1K, 2K, or 4K output

The AI generates thumbnails optimized for:
- Bold, contrasting colors that pop
- Clear visual hierarchy
- Emotional engagement and curiosity
- Visibility at small sizes (YouTube browse)

### 2. Face Integration
Creators can upload their face images to be naturally integrated into thumbnails:
- **Multiple face uploads** for consistency
- **Emotion selection** — Shocked, happy, excited, angry, confused, neutral, etc.
- **Pose options** — Pointing, hands up, thoughtful, etc.
- **Face library** — Save faces for quick reuse ("My Faces")

### 3. Style System
A powerful style management system:
- **Default Styles** — Curated presets (Cinematic, Minimalist, Bold, Retro, etc.)
- **Custom Styles** — Create and save personal styles with:
  - Style prompt/description
  - Reference images
  - Preview thumbnails
- **Style Browsing** — Discover community and public styles
- **Favorites** — Quick access to loved styles

### 4. Color Palettes
- **Default Palettes** — Red/Black, Blue/White, Neon, etc.
- **Custom Palettes** — Create palettes with hex color pickers
- **AI Palette Analysis** — Extract palettes from images
- **Palette Library** — Save and reuse ("My Palettes")

### 5. AI Title Enhancement
- Input a topic, get multiple clickable title suggestions
- Select multiple enhanced titles
- Generate one thumbnail per selected title
- Helps with A/B testing different hooks

### 6. Reference Images
- Upload reference images for style guidance
- AI uses references to inform composition, color, and mood
- Combine with style reference images for maximum control

### 7. Gallery & History
- **Gallery View** — All generated thumbnails with masonry layout
- **Favorites** — Heart/save thumbnails for quick access
- **Download** — Export at original resolution
- **Delete** — Remove unwanted generations

### 8. Thumbnail Editing
- **AI Edit** — Make post-generation adjustments with prompts
- Edit existing thumbnails without regenerating from scratch

---

## User Flows

### Primary Flow: Generate a Thumbnail
```
1. Enter video title/topic
2. (Optional) Add thumbnail text overlay
3. Select a style preset OR create custom style
4. Select color palette
5. (Optional) Enable face integration + upload face
6. Choose emotion and pose
7. Set resolution and aspect ratio
8. Set number of variations (1-4)
9. Click "Generate"
10. View results in live feed
11. Download, edit, or regenerate
```

### Secondary Flow: Use Enhanced Titles
```
1. Enter video topic
2. Click "Enhance" on title input
3. AI suggests 5-10 clickable variations
4. Select 1+ titles
5. Click "Generate from Titles"
6. One thumbnail generated per selected title
```

### Style Creation Flow
```
1. Click "Create Style"
2. Enter style name
3. Write style description/prompt
4. (Optional) Upload reference images
5. AI generates preview thumbnail
6. Save style to library
```

---

## Subscription Tiers

| Feature | Free | Starter ($19.99) | Advanced ($49.99) | Pro ($99.99) |
|---------|------|------------------|-------------------|--------------|
| Credits/month | 10 | 100 | 300 | 700 |
| Resolution | 1K only | 1K, 2K | 1K, 2K, 4K | 1K, 2K, 4K |
| Watermark | Yes | No | No | No |
| AI Title Enhancement | No | Yes | Yes | Yes |
| Storage | 30 days | Permanent | Permanent | Permanent |
| Priority Generation | No | No | Yes | Yes |
| Early Access | No | No | No | Yes |

### Credit System
- **1K resolution** = 1 credit
- **2K resolution** = 2 credits
- **4K resolution** = 4 credits

---

## Technical Architecture

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Context + TanStack Query
- **Routing**: React Router v6

### Backend (Next.js / Supabase)
- **Database**: PostgreSQL with RLS
- **Auth**: Supabase Auth (email, Google)
- **Storage**: Supabase Storage (faces, thumbnails, style previews)
- **API Routes**: Next.js API routes (server-side only)
- **Payments**: Stripe subscriptions

### AI Services
- **Image Generation**: Lovable AI Gateway (multi-model)
- **Title Enhancement**: Lovable AI
- **Style Analysis**: Lovable AI with vision capabilities

### Key Database Tables
- `thumbnails` — Generated thumbnails
- `styles` — User and default styles
- `palettes` — Color palettes
- `faces` — Saved face images
- `favorites` — User favorites
- `user_subscriptions` — Subscription state
- `credit_transactions` — Credit usage logs
- `profiles` — User profile data

---

## Page Structure

| Route | Page | Description |
|-------|------|-------------|
| `/` | Generator | Main thumbnail generation interface |
| `/gallery` | Gallery | User's generated thumbnails |
| `/browse` | Browse | Discover public styles & palettes |
| `/favorites` | Favorites | User's saved items |
| `/styles` | My Styles | User's custom styles |
| `/palettes` | My Palettes | User's custom palettes |
| `/faces` | My Faces | User's saved face images |
| `/pricing` | Pricing | Subscription plans |
| `/auth` | Authentication | Login/signup |


---

## Competitive Differentiation

| Competitor | Weakness We Address |
|------------|---------------------|
| Canva | Not AI-native, requires manual design skills |
| Thumbnail.ai | Limited style control, no face integration |
| Snappa | Template-based, not generative |
| Photoshop | Steep learning curve, time-intensive |

**Our Edge**: Seamless AI generation with deep customization (styles, faces, palettes) designed specifically for YouTube creators.

---

## Summary

ViewBait transforms the tedious process of creating YouTube thumbnails into a fast, creative, and enjoyable experience. By combining powerful AI with creator-centric features like face integration and style libraries, we help creators spend less time designing and more time creating content.

**Mission**: Empower every creator to have professional-quality thumbnails, regardless of design skills.
