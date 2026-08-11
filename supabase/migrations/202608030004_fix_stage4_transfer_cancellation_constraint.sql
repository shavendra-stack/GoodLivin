-- GoodLivin Stage 4 corrective migration: allow safe draft cancellation.
--
-- A draft transfer may be cancelled before dispatch, so it has no dispatch
-- timestamp. The original check required dispatched_at for every non-draft
-- status, which made the existing cancel_stock_transfer() workflow fail.
-- Dispatched and received transfers still require dispatched_at; the existing
-- received_at check remains in force. Re-running this migration is safe.

begin;

alter table public.stock_transfers
  drop constraint if exists stock_transfers_check1;

alter table public.stock_transfers
  add constraint stock_transfers_status_timestamps_check
  check (status in ('draft', 'cancelled') or dispatched_at is not null);

commit;
