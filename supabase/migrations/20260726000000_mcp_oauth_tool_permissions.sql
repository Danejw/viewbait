-- Expand MCP OAuth permissions for the first complete ViewBAIT tool surface.
-- Browser sessions keep their existing behavior. OAuth sessions are gated by
-- both tool permissions and RLS, including direct Supabase API access.

alter table public.mcp_oauth_clients
  alter column permissions set default array[
    'account:read',
    'projects:read',
    'projects:write',
    'assets:read',
    'thumbnails:read',
    'thumbnails:write',
    'thumbnails:compare',
    'generation:write'
  ]::text[];

update public.mcp_oauth_clients
set
  permissions = array(
    select distinct permission
    from unnest(
      permissions || array[
        'account:read',
        'projects:read',
        'projects:write',
        'assets:read',
        'thumbnails:read',
        'thumbnails:write',
        'thumbnails:compare',
        'generation:write'
      ]::text[]
    ) as permission
  ),
  updated_at = now();

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
  default_permissions constant text[] := array[
    'account:read',
    'projects:read',
    'projects:write',
    'assets:read',
    'thumbnails:read',
    'thumbnails:write',
    'thumbnails:compare',
    'generation:write'
  ]::text[];
begin
  claims := event->'claims';
  oauth_client_id := claims->>'client_id';

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

  claims := jsonb_set(
    claims,
    '{aud}',
    to_jsonb('https://viewbait.app/api/mcp'::text),
    true
  );
  claims := jsonb_set(
    claims,
    '{mcp_permissions}',
    to_jsonb(coalesce(client_permissions, default_permissions)),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb)
  from anon, authenticated, public;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

create or replace function public.mcp_has_any_permission(required_permissions text[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from unnest(required_permissions) as permission
    where public.mcp_has_permission(permission)
  );
$$;

grant execute on function public.mcp_has_any_permission(text[]) to authenticated;

-- Account context.
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('account:read')
    )
  );

drop policy if exists user_subscriptions_select_policy on public.user_subscriptions;
create policy user_subscriptions_select_policy on public.user_subscriptions
  for select to authenticated
  using (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['account:read', 'generation:write', 'thumbnails:write']::text[]
      )
    )
  );

-- Projects. projects:write implies the read access required by INSERT ... RETURNING.
drop policy if exists projects_select_policy on public.projects;
create policy projects_select_policy on public.projects
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      or id in (
        select project_id
        from public.project_editors
        where user_id = auth.uid()
      )
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['projects:read', 'projects:write', 'generation:write']::text[]
      )
    )
  );

drop policy if exists projects_insert_policy on public.projects;
create policy projects_insert_policy on public.projects
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('projects:write')
    )
  );

drop policy if exists projects_update_policy on public.projects;
create policy projects_update_policy on public.projects
  for update to authenticated
  using (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('projects:write')
    )
  )
  with check (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_permission('projects:write')
    )
  );

-- There is intentionally no OAuth project-delete tool.
drop policy if exists projects_delete_policy on public.projects;
create policy projects_delete_policy on public.projects
  for delete to authenticated
  using (
    user_id = auth.uid()
    and (auth.jwt()->>'client_id') is null
  );

drop policy if exists project_editors_select_policy on public.project_editors;
create policy project_editors_select_policy on public.project_editors
  for select to authenticated
  using (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['projects:read', 'projects:write', 'generation:write']::text[]
      )
    )
  );

-- Generation assets.
drop policy if exists styles_select_policy on public.styles;
create policy styles_select_policy on public.styles
  for select to authenticated
  using (
    (user_id = auth.uid() or is_default = true or is_public = true)
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['assets:read', 'generation:write']::text[]
      )
    )
  );

drop policy if exists palettes_select_policy on public.palettes;
create policy palettes_select_policy on public.palettes
  for select to authenticated
  using (
    (user_id = auth.uid() or is_default = true or is_public = true)
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['assets:read', 'generation:write']::text[]
      )
    )
  );

drop policy if exists faces_select_policy on public.faces;
create policy faces_select_policy on public.faces
  for select to authenticated
  using (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['assets:read', 'generation:write']::text[]
      )
    )
  );

-- Thumbnails. Write permissions imply the row reads required by generation,
-- editing, signed URL refresh, and INSERT/UPDATE ... RETURNING.
drop policy if exists thumbnails_select_policy on public.thumbnails;
create policy thumbnails_select_policy on public.thumbnails
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      or (
        project_id is not null
        and project_id in (
          select project_id
          from public.project_editors
          where user_id = auth.uid()
        )
      )
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array[
          'thumbnails:read',
          'thumbnails:write',
          'thumbnails:compare',
          'generation:write'
        ]::text[]
      )
    )
  );

drop policy if exists thumbnails_insert_policy on public.thumbnails;
create policy thumbnails_insert_policy on public.thumbnails
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['thumbnails:write', 'generation:write']::text[]
      )
    )
  );

drop policy if exists thumbnails_update_policy on public.thumbnails;
create policy thumbnails_update_policy on public.thumbnails
  for update to authenticated
  using (
    (
      user_id = auth.uid()
      or (
        project_id is not null
        and project_id in (
          select project_id
          from public.project_editors
          where user_id = auth.uid()
        )
      )
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['thumbnails:write', 'generation:write']::text[]
      )
    )
  )
  with check (
    (
      user_id = auth.uid()
      or (
        project_id is not null
        and project_id in (
          select project_id
          from public.project_editors
          where user_id = auth.uid()
        )
      )
    )
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['thumbnails:write', 'generation:write']::text[]
      )
    )
  );

drop policy if exists thumbnails_delete_policy on public.thumbnails;
create policy thumbnails_delete_policy on public.thumbnails
  for delete to authenticated
  using (
    user_id = auth.uid()
    and (
      (auth.jwt()->>'client_id') is null
      or public.mcp_has_any_permission(
        array['thumbnails:write', 'generation:write']::text[]
      )
    )
  );
