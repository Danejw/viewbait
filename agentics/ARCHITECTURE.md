# ViewBait - Technical Architecture

**This document defines canonical boundaries and where logic lives.** Agents must follow these patterns to prevent architectural drift.

---

## System Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  (Browser - React Components, Hooks, Zustand Stores)           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Components  │  │    Hooks     │  │   Zustand Stores    │ │
│  │              │  │              │  │                      │ │
│  │  - UI only   │  │  - useQuery  │  │  - UI state         │ │
│  │  - No direct │  │  - useMutation│  │  - Local state     │ │
│  │    API calls │  │  - Custom    │  │  - No server logic  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘ │
│         │                 │                                     │
│         └────────┬────────┘                                     │
│                  │                                              │
│         ┌────────▼────────┐                                    │
│         │   Services      │                                    │
│         │   (lib/services)│                                    │
│         │                  │                                    │
│         │  - API calls     │                                    │
│         │  - Supabase      │                                    │
│         │  - Type-safe     │                                    │
│         └────────┬─────────┘                                    │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER LAYER                                │
│  (Next.js - Route Handlers, Server Actions, Server Components)  │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  API Routes      │  │  Server Actions  │  │  Server     │ │
│  │  (app/api/...)   │  │  (app/actions/...)│  │  Components │ │
│  │                  │  │                  │  │             │ │
│  │  - Webhooks      │  │  - Mutations      │  │  - Initial  │ │
│  │  - External APIs │  │  - Form handling  │  │    data     │ │
│  │  - Public APIs   │  │  - Auth required  │  │  - SSR      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┘ │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                           │
│           ┌─────────▼──────────┐                                 │
│           │  Server Utils      │                                 │
│           │  (lib/server/...)  │                                 │
│           │                    │                                 │
│           │  - requireAuth()   │                                 │
│           │  - getOptionalAuth│                                 │
│           │  - error handlers │                                 │
│           │  - Supabase server │                                 │
│           └─────────┬──────────┘                                 │
└─────────────────────┼────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
│  (Supabase PostgreSQL with RLS)                                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Tables     │  │    Views     │  │   RPC Functions      │ │
│  │              │  │              │  │                      │ │
│  │  - RLS       │  │  - Safe reads│  │  - Sensitive ops    │ │
│  │  - user_id   │  │  - Filtered  │  │  - Audit logging    │ │
│  │  - org_id    │  │  - Joined    │  │  - Validation       │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Primary Server Surface

**Default: Next.js Route Handlers (`app/api/...`)**

- **API Routes** (`app/api/.../route.ts`): Primary server surface for all server logic
  - Webhooks (Stripe, external services)
  - Public API endpoints
  - Operations requiring secrets/privileged access
  - Aggregations across multiple services

- **Server Actions** (`app/actions/...`): For form mutations and direct user interactions
  - Form submissions
  - Mutations triggered from client components
  - Operations that benefit from progressive enhancement

- **Server Components**: For initial data fetching and SSR
  - Initial page data
  - Public content
  - SEO-critical data

**Rule of Thumb:**
- **API Routes**: External integrations, webhooks, public APIs, complex aggregations
- **Server Actions**: User-initiated mutations, form handling, progressive enhancement
- **Server Components**: Initial page data, SSR, public content
- **Edge Functions**: Not used in this repo (use API routes instead)

---

## Canonical Data Flow

### Read Flow (Views-First Pattern)

```
Client Component
    │
    ▼
React Query Hook (useQuery)
    │
    ▼
Service Layer (lib/services/...)
    │
    ▼
API Route (app/api/.../route.ts)
    │
    ├─► requireAuth() [lib/server/utils/auth.ts]
    │
    ▼
Supabase Server Client [lib/server/supabase.ts]
    │
    ▼
Database View (SELECT from view_name)
    │
    │ RLS enforced automatically
    │
    ▼
Return typed data
```

**Example:**

```typescript
// lib/services/thumbnails.ts
export async function getThumbnails(userId: string): Promise<Thumbnail[]> {
  const response = await fetch(`/api/thumbnails?userId=${userId}`);
  if (!response.ok) throw new Error('Failed to fetch thumbnails');
  return response.json();
}

// app/api/thumbnails/route.ts
import { requireAuth } from '@/lib/server/utils/auth';
import { createServerClient } from '@/lib/server/supabase';

export async function GET(request: Request) {
  const user = await requireAuth();
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('user_thumbnails_view')  // View, not table
    .select('*')
    .eq('user_id', user.id);
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json(data);
}

// hooks/useThumbnails.ts
import { useQuery } from '@tanstack/react-query';
import { getThumbnails } from '@/lib/services/thumbnails';

export function useThumbnails(userId: string) {
  return useQuery({
    queryKey: ['thumbnails', userId],
    queryFn: () => getThumbnails(userId),
    enabled: !!userId,
  });
}
```

### Write Flow (RPC-First for Sensitive Operations)

```
Client Component
    │
    ▼
React Query Mutation (useMutation)
    │
    ▼
Service Layer (lib/services/...)
    │
    ▼
API Route (app/api/.../route.ts)
    │
    ├─► requireAuth() [lib/server/utils/auth.ts]
    │
    ▼
Supabase RPC Function
    │
    ├─► Validates auth.uid()
    ├─► Enforces business rules
    ├─► Writes audit log
    │
    ▼
Database Table (INSERT/UPDATE)
    │
    │ RLS enforced
    │
    ▼
Return result
```

**Example:**

```typescript
// lib/services/thumbnails.ts
export async function createThumbnail(
  data: CreateThumbnailInput
): Promise<Thumbnail> {
  const response = await fetch('/api/thumbnails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create thumbnail');
  }
  return response.json();
}

// app/api/thumbnails/route.ts
import { requireAuth } from '@/lib/server/utils/auth';
import { createServerClient } from '@/lib/server/supabase';

export async function POST(request: Request) {
  const user = await requireAuth();
  const supabase = createServerClient();
  const body = await request.json();
  
  const { data, error } = await supabase.rpc('create_thumbnail', {
    p_user_id: user.id,
    p_prompt: body.prompt,
    p_face_ids: body.faceIds,
    p_style_id: body.styleId,
  });
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json(data);
}

// SQL: supabase/migrations/.../create_thumbnail_rpc.sql
CREATE OR REPLACE FUNCTION create_thumbnail(
  p_user_id uuid,
  p_prompt text,
  p_face_ids uuid[],
  p_style_id uuid
) RETURNS thumbnails
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thumbnail thumbnails;
BEGIN
  -- Validate user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Business logic validation
  IF array_length(p_face_ids, 1) > 10 THEN
    RAISE EXCEPTION 'Maximum 10 faces allowed';
  END IF;
  
  -- Insert thumbnail
  INSERT INTO thumbnails (user_id, prompt, face_ids, style_id, status)
  VALUES (p_user_id, p_prompt, p_face_ids, p_style_id, 'pending')
  RETURNING * INTO v_thumbnail;
  
  -- Audit log
  INSERT INTO audit_logs (actor_id, action, resource_type, resource_id)
  VALUES (p_user_id, 'create_thumbnail', 'thumbnail', v_thumbnail.id);
  
  RETURN v_thumbnail;
END;
$$;
```

---

## Tenancy Boundary Guidance

### Current State: Single-Tenant (Per-User)

**Default Pattern:** All tables include `user_id uuid NOT NULL` with RLS enforcing `user_id = auth.uid()`.

**When to Use Multi-Tenant:**
- Feature requires shared workspaces/organizations
- Users need to collaborate on resources
- Billing is organization-based

**Migration Path:**
1. Add `orgs` and `org_members` tables
2. Add `org_id` to tenant-owned tables
3. Update RLS policies to use `is_org_member(org_id)`
4. Migrate existing `user_id` data to appropriate orgs

**Architecture Decision:**
- **Single-tenant by default** unless feature explicitly requires multi-tenant
- If multi-tenant is needed, follow patterns in `docs/database_security_principles.md`

---

## Folder Conventions

### Directory Structure

```
viewbait/
├── app/                          # Next.js App Router
│   ├── api/                      # API route handlers
│   │   └── [resource]/
│   │       └── route.ts          # GET, POST, etc.
│   ├── actions/                  # Server Actions (optional)
│   │   └── [resource].ts
│   ├── (auth)/                   # Auth route group
│   ├── (app)/                    # App route group
│   └── layout.tsx                # Root layout
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   └── [feature]/                # Feature-specific components
│
├── lib/                          # Utilities and shared code
│   ├── server/                   # Server-only utilities
│   │   ├── utils/
│   │   │   ├── auth.ts          # requireAuth(), getOptionalAuth()
│   │   │   ├── errors.ts        # Error handlers
│   │   │   └── url-refresh.ts   # URL refresh utility
│   │   └── supabase.ts          # Server Supabase client
│   ├── services/                 # API service layer
│   │   ├── thumbnails.ts
│   │   ├── faces.ts
│   │   └── styles.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useThumbnails.ts
│   │   └── useFaces.ts
│   └── utils.ts                  # Shared utilities (cn, etc.)
│
├── types/                        # TypeScript types
│   ├── database.ts               # Generated DB types
│   └── [domain].ts               # Domain types
│
├── supabase/                     # Supabase config
│   ├── migrations/               # Database migrations
│   └── functions/                # Edge Functions (if used)
│
└── docs/                         # Documentation
    ├── database_security_principles.md
    ├── security_principles.md
    └── optimization_principles.md
```

### File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `ThumbnailCard.tsx`)
- **Hooks**: `useThing.ts` (e.g., `useThumbnails.ts`)
- **Services**: `camelCase.ts` (e.g., `thumbnails.ts`)
- **Utilities**: `camelCase.ts` (e.g., `auth.ts`, `errors.ts`)
- **Types**: `camelCase.ts` (e.g., `thumbnail.ts`, `database.ts`)
- **API Routes**: `route.ts` (Next.js convention)

### Where Logic Lives

| Logic Type | Location | Example |
|------------|----------|---------|
| UI rendering | `components/` | `ThumbnailCard.tsx` |
| Client state | `hooks/` or Zustand stores | `useThumbnails.ts` |
| API calls | `lib/services/` | `lib/services/thumbnails.ts` |
| Server auth | `lib/server/utils/auth.ts` | `requireAuth()` |
| Server utilities | `lib/server/utils/` | `errors.ts`, `url-refresh.ts` |
| Database access | API routes → Supabase client | `app/api/thumbnails/route.ts` |
| Business logic | RPC functions or API routes | `supabase/migrations/.../rpc.sql` |
| Database schema | `supabase/migrations/` | `001_initial_schema.sql` |
| Types | `types/` | `types/database.ts` |

---

## No-Go Zones (Hard Constraints)

### ❌ Service Role in Client Code

```typescript
// ❌ NEVER: Service role in browser
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, serviceRoleKey); // NEVER!

// ✅ ALWAYS: Anon key in client, service role only server-side
// Client:
const supabase = createClient(url, anonKey);

// Server:
import { createServerClient } from '@/lib/server/supabase';
const supabase = createServerClient(); // Uses service role internally if needed
```

### ❌ Direct Database Queries from Client

```typescript
// ❌ NEVER: Direct table access from client
const { data } = await supabase.from('thumbnails').select('*');

// ✅ ALWAYS: Use views or go through API routes
// Option 1: Use views
const { data } = await supabase.from('user_thumbnails_view').select('*');

// Option 2: Use API routes
const data = await getThumbnails(userId); // Service → API route
```

### ❌ Client Writing to Membership Tables

```typescript
// ❌ NEVER: Client directly modifies org_members
await supabase.from('org_members').insert({ org_id, user_id, role });

// ✅ ALWAYS: Use RPC with validation
await supabase.rpc('add_org_member', { p_org_id, p_user_id, p_role });
```

### ❌ Bypassing RLS for Convenience

```typescript
// ❌ NEVER: Disable RLS or use service role to bypass
ALTER TABLE thumbnails DISABLE ROW LEVEL SECURITY; // NEVER!

// ✅ ALWAYS: Fix RLS policies, don't bypass them
CREATE POLICY user_thumbnails_policy ON thumbnails
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
```

### ❌ Secrets in Client Code

```typescript
// ❌ NEVER: API keys in client code
const GEMINI_KEY = 'AIza...'; // NEVER!

// ✅ ALWAYS: Secrets in server-only code
// .env.local (server only):
GEMINI_API_KEY=AIza...

// API route:
const key = process.env.GEMINI_API_KEY; // Server-only
```

### ❌ Business Logic in Components

```typescript
// ❌ NEVER: Complex logic in components
function ThumbnailCard({ thumbnail }) {
  const canEdit = thumbnail.user_id === currentUser.id && 
                  thumbnail.status !== 'completed' &&
                  !thumbnail.locked; // Too much logic
  
  // ...
}

// ✅ ALWAYS: Extract to services/hooks
function useThumbnailPermissions(thumbnail) {
  return useMemo(() => ({
    canEdit: canEditThumbnail(thumbnail, currentUser),
    canDelete: canDeleteThumbnail(thumbnail, currentUser),
  }), [thumbnail, currentUser]);
}
```

---

## Authentication Flow

### Server-Side Auth Pattern

```typescript
// lib/server/utils/auth.ts

import { createServerClient } from '@/lib/server/supabase';
import { cookies } from 'next/headers';

export async function requireAuth(): Promise<User> {
  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function getOptionalAuth(): Promise<User | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Usage in API routes
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    // ... handle request
  } catch (error) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### Client-Side Auth Pattern

```typescript
// hooks/useAuth.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/client/supabase';

export function useAuth() {
  const supabase = createClient();
  
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
}
```

---

## Data Access Patterns

### Pattern 1: Views for Reads (Preferred)

```sql
-- Create view with RLS-safe columns
CREATE VIEW user_thumbnails_view AS
SELECT 
  id,
  prompt,
  status,
  created_at,
  -- Don't expose sensitive columns
  -- user_id is implicit via RLS
FROM thumbnails;

-- Enable RLS on view (inherits from table)
ALTER VIEW user_thumbnails_view SET (security_invoker = true);
```

### Pattern 2: RPC for Writes (Required for Sensitive Operations)

```sql
-- All sensitive writes go through RPC
CREATE OR REPLACE FUNCTION create_thumbnail(...)
RETURNS thumbnails
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  -- Validate auth
  -- Enforce business rules
  -- Write audit log
  -- Return result
$$;
```

### Pattern 3: Direct Table Access (Only for Simple, Safe Operations)

```typescript
// Only for operations that are:
// 1. Simple (single table)
// 2. Safe (RLS fully protects)
// 3. Not sensitive (no audit needed)

// Example: User updating their own profile
const { data } = await supabase
  .from('profiles')
  .update({ name: newName })
  .eq('id', user.id); // RLS ensures user can only update their own
```

---

## Migrations and RLS Change Risk

### Migration Workflow

1. **Create Migration**: `supabase migration new [name]`
2. **Write SQL**: Include schema changes + RLS policies
3. **Test Locally**: Use Supabase CLI to test migrations
4. **Review RLS Impact**: Ensure no access is accidentally widened
5. **Deploy**: Apply migration to staging, then production

### RLS Change Checklist

Before modifying RLS policies:

- [ ] Identify all affected tables
- [ ] Document current access patterns
- [ ] Test with different user roles
- [ ] Verify tenant isolation (if multi-tenant)
- [ ] Check view dependencies
- [ ] Verify RPC functions still work
- [ ] Test rollback scenario

### High-Risk RLS Changes

These changes require extra caution:

- **Removing RLS**: Never remove RLS without replacement
- **Changing policy conditions**: May break existing access
- **Adding new tables**: Must have RLS from day one
- **Modifying views**: May expose previously hidden data
- **Changing membership logic**: Affects all tenant-isolated tables

**Process:**
1. Create migration with new policies
2. Test in local/staging environment
3. Verify with multiple test users
4. Deploy during low-traffic window
5. Monitor for access errors

---

## Service Layer Pattern

### Service Structure

```typescript
// lib/services/thumbnails.ts

import type { Thumbnail, CreateThumbnailInput } from '@/types/thumbnail';

const API_BASE = '/api/thumbnails';

export async function getThumbnails(userId: string): Promise<Thumbnail[]> {
  const response = await fetch(`${API_BASE}?userId=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch thumbnails');
  }
  return response.json();
}

export async function getThumbnail(id: string): Promise<Thumbnail> {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch thumbnail');
  }
  return response.json();
}

export async function createThumbnail(
  input: CreateThumbnailInput
): Promise<Thumbnail> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create thumbnail');
  }
  
  return response.json();
}

export async function deleteThumbnail(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete thumbnail');
  }
}
```

### React Query Integration

```typescript
// hooks/useThumbnails.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getThumbnails, createThumbnail, deleteThumbnail } from '@/lib/services/thumbnails';

export function useThumbnails(userId: string) {
  return useQuery({
    queryKey: ['thumbnails', userId],
    queryFn: () => getThumbnails(userId),
    enabled: !!userId,
  });
}

export function useCreateThumbnail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createThumbnail,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['thumbnails', data.user_id] });
    },
  });
}

export function useDeleteThumbnail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteThumbnail,
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['thumbnails', userId] });
    },
  });
}
```

---

## Error Handling Pattern

### Standardized Error Responses

```typescript
// lib/server/utils/errors.ts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error);
  
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

// Usage in API routes
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    // ... logic
  } catch (error) {
    return handleError(error);
  }
}
```

---

## Summary: Architecture Rules

1. **Client → Service → API Route → Database**: Never skip layers
2. **Views for reads, RPC for sensitive writes**: Enforce at database level
3. **Service layer abstracts API calls**: Components never call APIs directly
4. **React Query for client data**: Hooks wrap services, not direct API calls
5. **Server utilities are centralized**: `requireAuth()`, error handlers in `lib/server/utils/`
6. **RLS is non-negotiable**: All user/tenant data tables must have RLS
7. **Service role is server-only**: Never in browser code
8. **Types are shared**: Database types in `types/database.ts`, domain types in `types/`
9. **Migrations are versioned**: All schema changes go through migrations
10. **No business logic in components**: Extract to services, hooks, or RPC functions

---

## References

- **Database Security**: `docs/database_security_principles.md` (MUST READ before DB changes)
- **General Security**: `docs/security_principles.md`
- **Optimization**: `docs/optimization_principles.md`
- **Testing**: `agentics/TESTING_CONSTITUTION.md`
- **Project Facts**: `agentics/PROJECT_FACTS.md`
