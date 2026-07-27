-- OAuth client permissions and strict MCP audience binding for ViewBAIT.
-- Run this migration, then enable public.custom_access_token_hook in
-- Supabase Dashboard > Authentication > Hooks > Custom Access Token.
--
-- Lifecycle: mcp_oauth_clients is admin/system config (not end-user PII).
-- Retention: keep while the OAuth client is active; delete row to revoke.

create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  enabled boolean not null default true,
  permissions text[] not null default array['projects:read', 'thumbnails:read']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mcp_oauth_clients enable row level security;

drop policy if exists "Supabase Auth can read MCP OAuth clients" on public.mcp_oauth_clients;
create policy "Supabase Auth can read MCP OAuth clients"
on public.mcp_oauth_clients
for select
to supabase_auth_admin
using (true);

grant usage on schema public to supabase_auth_admin;
revoke all on table public.mcp_oauth_clients from anon, authenticated, public;
grant select on table public.mcp_oauth_clients to supabase_auth_admin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  oauth_client_id text;
  client_enabled boolean;
  client_permissions text[];
begin
  claims := event->'claims';
  oauth_client_id := claims->>'client_id';

  -- Normal browser sessions have no OAuth client_id and keep their normal audience.
  if oauth_client_id is null then
    return jsonb_build_object('claims', claims);
  end if;

  select enabled, permissions
    into client_enabled, client_permissions
  from public.mcp_oauth_clients
  where client_id = oauth_client_id;

  if client_enabled is false then
    raise exception 'OAuth client is disabled';
  end if;

  claims := jsonb_set(claims, '{aud}', to_jsonb('https://viewbait.app/api/mcp'::text), true);
  claims := jsonb_set(
    claims,
    '{mcp_permissions}',
    to_jsonb(coalesce(client_permissions, array['projects:read', 'thumbnails:read']::text[])),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.mcp_has_permission(required_permission text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt()->'mcp_permissions') ? required_permission, false);
$$;

grant execute on function public.mcp_has_permission(text) to authenticated;

-- Browser sessions (no OAuth client_id) keep ownership + editor RLS from 010.
-- MCP OAuth tokens must also carry the matching mcp_permissions claim.
drop policy if exists projects_select_policy on public.projects;
create policy projects_select_policy on public.projects
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      or id in (select project_id from public.project_editors where user_id = auth.uid())
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('projects:read')
    )
  );

drop policy if exists thumbnails_select_policy on public.thumbnails;
create policy thumbnails_select_policy on public.thumbnails
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      or (
        project_id is not null
        and project_id in (
          select project_id from public.project_editors where user_id = auth.uid()
        )
      )
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('thumbnails:read')
    )
  );

-- Add client-specific permissions after a client registers, for example:
-- insert into public.mcp_oauth_clients (client_id, permissions)
-- values ('CLIENT_ID', array['projects:read', 'thumbnails:read'])
-- on conflict (client_id) do update set permissions = excluded.permissions, updated_at = now();
