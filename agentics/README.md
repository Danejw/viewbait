# ViewBait

AI-powered thumbnail generator for content creators.

## Documentation

| Document | Description |
|----------|-------------|
| [VISION.md](./VISION.md) | Product vision, value proposition, and feature overview |
| [DESIGN_PRINCIPLES.md](./DESIGN_PRINCIPLES.md) | Visual design system, colors, typography, animations |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, state management, AI agent design |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Directory structure, key files, component guidelines |
| [DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql) | Complete database schema with RLS policies |
| [mobile_first_principles.md](./mobile_first_principles.md) | This document outlines the core principles for designing user interfaces with a mobile-first approach, essential for ensuring optimal experience on small screens. |
| [TESTING_CONSTITUTION.md](./TESTING_CONSTITUTION.md) | Testing strategy and requirements: Test-Driven Development (TDD) approach, what to test, development workflow, and agent instructions for unit testing |

## Additional Documentation

Additional technical documentation is available in the `docs/` folder:

- **[Database Security Principles](../docs/database_security_principles.md)**: Hard constraints for Postgres + Supabase database design. **MUST READ** before making any database changes. Covers RLS policies, single-tenant and multi-tenant patterns, audit logging, and verification requirements. Use this when designing tables, policies, views, or RPC functions.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- Gemini API key

### Setup

1. Clone and install dependencies:
```bash
git clone <repo>
cd viewbait
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Fill in your Supabase and Gemini credentials
```

3. Set up the database:
```bash
# Apply the schema from DATABASE_SCHEMA.sql in Supabase Dashboard
# Or use Supabase CLI:
supabase db push
```

4. Generate TypeScript types:
```bash
pnpm db:generate
```

5. Run development server:
```bash
pnpm dev
```

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18, shadcn/ui, Tailwind CSS
- **State**: Zustand
- **Backend**: Supabase (Auth, Database, Storage)
- **AI**: Gemini API
- **Hosting**: Vercel

## Key Features

- **Conversational AI** - Describe thumbnails in natural language
- **Face Library** - Save and reuse face references
- **Style System** - Save and apply visual styles
- **Batch Generation** - Create multiple variations
- **Real-time Updates** - See generation progress live

## Design Principles

- **Creator-focused** - Built for content creators
- **Neutral with red accent** - YouTube-inspired color scheme
- **Animation-first** - Smooth, responsive interactions
- **Component consistency** - No one-off components
- **Mobile parity** - Same experience on all devices

## Architecture Overview

```
┌─────────────┬─────────────────────┬─────────────────────┐
│   SIDEBAR   │   CHAT/SETTINGS     │       CANVAS        │
│   (nav)     │   (interaction)     │       (results)     │
└─────────────┴─────────────────────┴─────────────────────┘
```

On mobile, these collapse to tabs with the same mental model.

## License

Proprietary
