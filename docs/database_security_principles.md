# Postgres + Supabase Database Security Principles

**This file is a hard constraint system.** If a proposed database change violates any rule below, redesign the solution until it complies.

---

## Global Rules (Always Apply)

### Default Security Posture

- **Every new table** that stores user or tenant data **must have RLS enabled**.
- **No access is allowed** unless explicitly granted via RLS policies.
- **Never rely on API/client code** as the primary permission boundary.

### Service Role Policy

- Supabase service role **bypasses RLS** and is treated as root access.
- Service role **must never be used in the browser**.
- If elevated access is needed, prefer **RPC (SQL functions)** with explicit checks + audit logging over bypassing RLS.

### Data Minimization

- Only store what the feature needs.
- Do not collect or store PII "just in case."

### No PII Sprawl

- Do not duplicate PII (email, phone, addresses, IPs, legal names) into product tables.
- Keep PII in a minimal `profiles`-style table keyed by `user_id` (or use auth as source of truth).
- Product tables should reference `user_id` / `org_id`, not copy identifiers.

### Views are the Safe Read Interface

- Prefer views for application reads to expose only intended columns.
- Avoid `select *` in views.
- Views must not accidentally widen access via joins; underlying tables' RLS must still enforce isolation.

### Sensitive Operations Go Through RPC

Use SQL functions (RPC) for:
- exports
- admin actions
- role/membership changes
- billing/credits mutations
- backfills/migrations that change security-relevant fields

RPC must validate `auth.uid()` and role membership, and must write an audit log entry for sensitive actions.

### Immutable Ledgers for Money/Credits/Security Events

- Use append-only ledger tables for credits, payments, and security-sensitive events.
- Never directly update "balance" as a normal application write.
- Derived balances are allowed only if updated through controlled RPC/triggers with strict checks.

### Lifecycle is a Schema Feature

For any table containing user/tenant data, the design must include:
- ownership keys (`user_id` and/or `org_id`)
- timestamps (`created_at`; `updated_at` if relevant)
- a deletion/retention plan (hard delete vs anonymize vs archive)

Backups and logs are part of the lifecycle story; do not assume deletion is instantaneous everywhere.

### RLS Correctness is Tested, Not Assumed

Any change touching tables/policies/views must include a verification step:
- validate access with a different user
- validate tenant isolation (multi-tenant)
- validate views do not leak columns/rows

---

## Single-Tenant Rules (Per-User Ownership)

### Required Table Shape

- Every user-owned table must have: `user_id uuid not null`
- `user_id` must reference the canonical user identifier (typically `auth.users(id)` or a profiles table keyed by auth id)

### Canonical RLS Templates

These policies are the default unless explicitly justified.

#### SELECT

Allow read only if the row is owned by the requesting user:

```sql
CREATE POLICY user_select_policy ON table_name
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

#### INSERT

User can insert only rows they own:

```sql
CREATE POLICY user_insert_policy ON table_name
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

#### UPDATE / DELETE

User can modify only rows they own:

```sql
CREATE POLICY user_update_policy ON table_name
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_delete_policy ON table_name
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

### Ownership Must be Enforced at the Database Boundary

- If the feature allows user creation of rows, insertion must guarantee `user_id = auth.uid()` through RLS WITH CHECK or RPC.
- Do not allow client-supplied `user_id` without enforcement.

### Join Safety

If a view joins multiple tables:
- all joined tables must have compatible RLS based on `auth.uid()`
- the view must expose only necessary fields
- no accidental leakage via foreign tables lacking RLS

**Example:**

```sql
-- ✅ GOOD: View with explicit column selection and RLS-safe joins
CREATE VIEW user_projects_view AS
SELECT 
  p.id,
  p.name,
  p.created_at,
  u.email  -- Only expose necessary fields
FROM projects p
JOIN auth.users u ON p.user_id = u.id
WHERE p.user_id = auth.uid();  -- RLS still applies

-- ❌ BAD: View with select * that might leak data
CREATE VIEW user_projects_view AS
SELECT * FROM projects p
JOIN auth.users u ON p.user_id = u.id;
```

---

## Multi-Tenant Rules (Org / Workspace Isolation)

### Required Core Tables

The schema must include:

```sql
-- Organizations table
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organization members table
CREATE TABLE org_members (
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'admin', 'owner')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id),
  UNIQUE (org_id, user_id)
);
```

### Tenant-Owned Table Shape

Every tenant-owned table must include:
- `org_id uuid not null`

Often also:
- `created_by uuid not null` (default or enforced as `auth.uid()`)

**Example:**

```sql
CREATE TABLE org_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Canonical Membership Check

- Create a single canonical helper function, used by all policies:

```sql
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_members
    WHERE org_members.org_id = is_org_member.org_id
      AND org_members.user_id = auth.uid()
  );
$$;
```

- Policies must rely on this function to avoid inconsistent membership logic.

### Canonical RLS Templates (Member Baseline)

#### SELECT

Allow read if the user is a member of the row's org:

```sql
CREATE POLICY org_select_policy ON org_projects
  FOR SELECT
  TO authenticated
  USING (is_org_member(org_id));
```

#### INSERT

Allow insert only into orgs the user belongs to, and ensure creator is correct:

```sql
CREATE POLICY org_insert_policy ON org_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(org_id) 
    AND created_by = auth.uid()
  );
```

#### UPDATE / DELETE

Must be explicit per table:

**For member-owned rows** (user can edit their own):

```sql
CREATE POLICY org_update_policy ON org_projects
  FOR UPDATE
  TO authenticated
  USING (
    is_org_member(org_id) 
    AND created_by = auth.uid()
  )
  WITH CHECK (
    is_org_member(org_id) 
    AND created_by = auth.uid()
  );

CREATE POLICY org_delete_policy ON org_projects
  FOR DELETE
  TO authenticated
  USING (
    is_org_member(org_id) 
    AND created_by = auth.uid()
  );
```

**For admin-only rows** (only admins can edit):

```sql
-- Helper function for role checks
CREATE OR REPLACE FUNCTION has_org_role(
  org_id uuid,
  min_role text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_members
    WHERE org_members.org_id = has_org_role.org_id
      AND org_members.user_id = auth.uid()
      AND (
        CASE min_role
          WHEN 'owner' THEN org_members.role = 'owner'
          WHEN 'admin' THEN org_members.role IN ('admin', 'owner')
          ELSE true
        END
      )
  );
$$;

CREATE POLICY org_admin_update_policy ON org_settings
  FOR UPDATE
  TO authenticated
  USING (has_org_role(org_id, 'admin'))
  WITH CHECK (has_org_role(org_id, 'admin'));
```

No ambiguous "member can edit anything" defaults.

### Role-Based Access Rules

- Role is stored in `org_members.role`.
- Implement role checks via helper functions (example: `has_org_role(org_id, min_role)`).
- Never use email allowlists or client-side role checks as the source of truth.

### Prevent Cross-Tenant References

Foreign keys and references must not allow cross-org linking:

- If table A references table B, both must carry `org_id`.
- Enforce matching org boundaries via:
  - composite keys, or
  - triggers, or
  - function-only writes (preferred for complex cases)

**Example with composite key enforcement:**

```sql
CREATE TABLE org_projects (
  id uuid,
  org_id uuid NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (id, org_id)
);

CREATE TABLE org_tasks (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  FOREIGN KEY (project_id, org_id) 
    REFERENCES org_projects(id, org_id) 
    ON DELETE CASCADE,
  -- Ensure task org matches project org
  CHECK (org_id = (
    SELECT org_id FROM org_projects 
    WHERE id = project_id
  ))
);
```

If an entity can move across orgs, that behavior must be explicit, audited, and implemented via RPC.

### Membership and Invites are Sensitive

- `org_members` changes must be admin/owner controlled.
- Invitations should use `org_invites` with strict RLS:

```sql
CREATE TABLE org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (org_id, email)
);

-- Invitee can see only their invite
CREATE POLICY invitee_select_policy ON org_invites
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Org admins can manage invites
CREATE POLICY admin_invite_policy ON org_invites
  FOR ALL
  TO authenticated
  USING (has_org_role(org_id, 'admin'))
  WITH CHECK (has_org_role(org_id, 'admin'));
```

- Membership changes must write to audit logs.

---

## Audit Logging Requirements

### When Audit Logs are Mandatory

If a feature touches any of the following, the agent must add audit logging:
- exports or bulk reads of user data
- role / membership changes
- billing / credits changes
- admin impersonation-like access
- security configuration changes
- any use of elevated privileges via RPC

### Audit Log Characteristics

- append-only (no updates/deletes)
- stores: actor (`auth.uid()`), action, target ids, timestamp, metadata (jsonb)
- never stores secrets in plaintext

**Example audit log table:**

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  org_id uuid REFERENCES orgs(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS: Users can only see audit logs for their orgs or themselves
CREATE POLICY audit_log_select_policy ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR (org_id IS NOT NULL AND is_org_member(org_id))
  );

-- Only system/RPC can insert
CREATE POLICY audit_log_insert_policy ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Only RPC functions can insert
```

**Example RPC with audit logging:**

```sql
CREATE OR REPLACE FUNCTION change_org_member_role(
  target_org_id uuid,
  target_user_id uuid,
  new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Verify requester is admin/owner
  SELECT role INTO current_user_role
  FROM org_members
  WHERE org_id = target_org_id
    AND user_id = auth.uid();
  
  IF current_user_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Update role
  UPDATE org_members
  SET role = new_role
  WHERE org_id = target_org_id
    AND user_id = target_user_id;
  
  -- Audit log
  INSERT INTO audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    org_id,
    metadata
  ) VALUES (
    auth.uid(),
    'change_member_role',
    'org_member',
    target_user_id,
    target_org_id,
    jsonb_build_object(
      'old_role', (SELECT role FROM org_members 
                   WHERE org_id = target_org_id 
                   AND user_id = target_user_id),
      'new_role', new_role
    )
  );
END;
$$;
```

---

## Verification Checklist (Must Pass)

### Single-Tenant

- [ ] user A cannot read user B rows
- [ ] user A cannot update/delete user B rows
- [ ] user A cannot insert rows with `user_id != auth.uid()`
- [ ] views do not expose sensitive columns

**Test Example:**

```sql
-- As user A
SET LOCAL request.jwt.claim.sub = 'user-a-uuid';
SELECT * FROM user_projects;  -- Should only see user A's projects

-- As user B
SET LOCAL request.jwt.claim.sub = 'user-b-uuid';
SELECT * FROM user_projects;  -- Should only see user B's projects
-- Attempting to update user A's project should fail
UPDATE user_projects SET name = 'hacked' WHERE user_id = 'user-a-uuid';  -- Should fail
```

### Multi-Tenant

- [ ] user A cannot read org B rows
- [ ] user A cannot insert rows into org B
- [ ] non-admin cannot change roles/memberships/invites
- [ ] views do not leak cross-org rows or sensitive columns

**Test Example:**

```sql
-- User A is member of org-1, not org-2
SET LOCAL request.jwt.claim.sub = 'user-a-uuid';

-- Should only see org-1 projects
SELECT * FROM org_projects WHERE org_id = 'org-1-uuid';  -- Should succeed
SELECT * FROM org_projects WHERE org_id = 'org-2-uuid';  -- Should return empty

-- Should not be able to insert into org-2
INSERT INTO org_projects (org_id, created_by, name) 
VALUES ('org-2-uuid', auth.uid(), 'hacked');  -- Should fail

-- Non-admin should not change roles
SELECT change_org_member_role('org-1-uuid', 'user-b-uuid', 'admin');  -- Should fail if user A is not admin
```

---

## Non-Negotiables Summary

- ✅ **RLS is required** for all user/tenant data tables
- ✅ **Ownership keys are required** (`user_id` and/or `org_id`)
- ✅ **Service role is server-only** and never a shortcut
- ✅ **Sensitive operations use RPC + audit logs**
- ✅ **Views are least-privilege interfaces**
- ✅ **Tenant isolation must be provable via tests**

---

## Common Anti-Patterns to Avoid

### ❌ Disabling RLS for Convenience

```sql
-- ❌ BAD: Disabling RLS
ALTER TABLE user_data DISABLE ROW LEVEL SECURITY;
```

**Why it's wrong:** Removes all database-level security. Client code becomes the only security boundary.

### ❌ Client-Supplied user_id Without Enforcement

```sql
-- ❌ BAD: No RLS, relies on client to set user_id
CREATE TABLE user_data (
  id uuid PRIMARY KEY,
  user_id uuid,  -- Client can set this to anything!
  data text
);
```

**Why it's wrong:** Client can impersonate any user.

### ❌ Service Role in Browser

```typescript
// ❌ BAD: Service role in client code
const supabase = createClient(url, serviceRoleKey);  // NEVER!
```

**Why it's wrong:** Service role bypasses all RLS. If exposed, attacker has full database access.

### ❌ Views Without RLS on Underlying Tables

```sql
-- ❌ BAD: View on table without RLS
CREATE TABLE sensitive_data (
  id uuid,
  user_id uuid,
  secret text
);  -- No RLS!

CREATE VIEW public_data AS SELECT id, user_id FROM sensitive_data;
```

**Why it's wrong:** View doesn't protect underlying data. Users can query table directly.

### ❌ Cross-Tenant Foreign Keys

```sql
-- ❌ BAD: Task can reference project from different org
CREATE TABLE org_tasks (
  id uuid,
  org_id uuid,
  project_id uuid REFERENCES org_projects(id)  -- No org_id check!
);
```

**Why it's wrong:** User can create task in org-1 that references project in org-2.

---

## Implementation Workflow

When implementing database changes:

1. **Design schema** with ownership keys (`user_id`/`org_id`)
2. **Enable RLS** on all user/tenant tables
3. **Create policies** using canonical templates
4. **Create helper functions** for membership/role checks (multi-tenant)
5. **Create views** for safe read interfaces
6. **Create RPC functions** for sensitive operations with audit logging
7. **Write verification tests** to prove isolation
8. **Document** any deviations from templates with justification

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL RLS Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- See also: `docs/security_principles.md` for general security guidelines
