-- GoodLivin Stage 1 corrective migration
-- Fixes Auth user creation failures caused by the generic audit trigger
-- assuming every audited table has an `id` column. `profiles` uses `user_id`
-- as its primary key.

begin;

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
begin
  if tg_op = 'DELETE' then
    before_snapshot := to_jsonb(old);
  else
    after_snapshot := to_jsonb(new);
    if tg_op = 'UPDATE' then
      before_snapshot := to_jsonb(old);
    end if;
  end if;

  -- Most audited tables use id; profiles uses user_id.
  changed_record_id := nullif(
    coalesce(
      after_snapshot ->> 'id',
      before_snapshot ->> 'id',
      after_snapshot ->> 'user_id',
      before_snapshot ->> 'user_id'
    ),
    ''
  )::uuid;

  perform public.write_audit_log(
    tg_table_name,
    changed_record_id,
    lower(tg_op),
    before_snapshot,
    after_snapshot,
    null
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

commit;
