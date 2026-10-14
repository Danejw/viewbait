-- Stop project editors from rewriting thumbnail rows they do not own.
--
-- thumbnails_update_policy lets an editor UPDATE any column when the new row
-- still belongs to a project they edit, or when the new user_id is themselves.
-- PostgREST is exposed to the browser session, so an invited editor can:
--   1. Join via the editor link (response includes project id).
--   2. SELECT thumbnails for that project (editor select policy).
--   3. PATCH user_id to their own id (and project_id to null).
-- The thumbnail then leaves the owner's library. The editor's delete policy
-- (user_id = auth.uid()) lets them delete it.
--
-- Owners may still update their own rows, except reassigning user_id.
-- Editors may still update comments and the comment CAS timestamp.
-- Service-role writes have no auth.uid() and are unchanged.
-- No new table. Existing thumbnail retention rules are unchanged.

create or replace function public.enforce_thumbnail_update_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.user_id is distinct from old.user_id then
      raise exception 'thumbnail ownership cannot be reassigned'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (pg_catalog.to_jsonb(new) - 'comments' - 'updated_at')
     is distinct from
     (pg_catalog.to_jsonb(old) - 'comments' - 'updated_at') then
    raise exception 'project editors can only update thumbnail comments'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_thumbnail_update_columns() is
  'Blocks thumbnail ownership transfer and limits project-editor updates to comments.';

revoke all on function public.enforce_thumbnail_update_columns() from public;
revoke all on function public.enforce_thumbnail_update_columns() from anon;
grant execute on function public.enforce_thumbnail_update_columns() to authenticated, service_role;

drop trigger if exists thumbnails_enforce_update_columns on public.thumbnails;
create trigger thumbnails_enforce_update_columns
  before update on public.thumbnails
  for each row
  execute function public.enforce_thumbnail_update_columns();
