-- Align MCP OAuth audience with the non-redirecting host.
-- Vercel sends apex viewbait.app → www with 307, which breaks Cursor's
-- MCP OAuth discovery/token exchange when clients target the apex URL.

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
    to_jsonb('https://www.viewbait.app/api/mcp'::text),
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
