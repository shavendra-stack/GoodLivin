begin;

-- Keep this migration self-contained in case it is copied into Supabase
-- without the companion audit correction. The function is also defined by
-- 202608030000_fix_audit_row_change_primary_key.sql and is safe to replace
-- again before profile rows are normalized.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_record_id uuid;
  audit_reason text;
begin
  if tg_op = 'DELETE' then
    before_snapshot := to_jsonb(old);
  else
    after_snapshot := to_jsonb(new);
    if tg_op = 'UPDATE' then
      before_snapshot := to_jsonb(old);
    end if;
  end if;

  changed_record_id := nullif(
    coalesce(
      after_snapshot ->> 'id',
      before_snapshot ->> 'id',
      after_snapshot ->> 'user_id',
      before_snapshot ->> 'user_id'
    ),
    ''
  )::uuid;

  if tg_table_name = 'product_batches' then
    audit_reason := coalesce(
      after_snapshot ->> 'correction_reason',
      before_snapshot ->> 'correction_reason'
    );
  end if;

  perform public.write_audit_log(
    tg_table_name,
    changed_record_id,
    lower(tg_op),
    before_snapshot,
    after_snapshot,
    audit_reason
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Keep the profile as the source of truth for the display name. New auth users
-- receive a neutral value when no full_name metadata was supplied, rather than
-- exposing the local part of their email address.
alter table public.profiles
  alter column display_name set default 'Team member';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
begin
  full_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');

  insert into public.profiles (user_id, email, display_name)
  values (new.id, new.email, coalesce(full_name, 'Team member'))
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$;

-- Normalize only known generated values. A manually entered name is preserved.
update public.profiles as profile
set display_name = 'Team member'
from auth.users as auth_user
where profile.user_id = auth_user.id
  and nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), '') is null
  and (
    nullif(trim(profile.display_name), '') is null
    or lower(trim(profile.display_name)) = lower('GoodLivin user')
    or lower(trim(profile.display_name)) = lower(trim(split_part(coalesce(auth_user.email, ''), '@', 1)))
  );

commit;
