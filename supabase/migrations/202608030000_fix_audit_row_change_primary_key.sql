-- GoodLivin corrective migration
-- The shared audit trigger must support both id-based tables and profiles,
-- whose primary key is user_id. This replacement keeps the existing audit
-- snapshots and Stage 3 correction-reason behavior intact.

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

  -- Current audited tables use id, except profiles, which uses user_id.
  -- JSON snapshots avoid dereferencing a field that does not exist on the
  -- current record type.
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

commit;
