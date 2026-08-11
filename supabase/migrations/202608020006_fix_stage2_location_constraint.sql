-- GoodLivin Stage 2 corrective migration
--
-- Stage 1's unnamed inventory-location check was retained when the Stage 2
-- vocabulary was added. Its legacy predicate rejects valid Stage 2 location
-- types. The expanded check and relationship trigger remain in force.

begin;

alter table public.inventory_locations
  drop constraint if exists inventory_locations_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_locations'::regclass
      and conname = 'inventory_locations_location_type_check'
  ) then
    alter table public.inventory_locations
      add constraint inventory_locations_location_type_check check (
        location_type in (
          'warehouse', 'main_warehouse', 'office_stock', 'online_order_stock',
          'event_stock', 'retailer_branch', 'sample_influencer_stock',
          'damaged_stock', 'quarantine', 'quarantine_stock', 'expired_stock',
          'transit', 'production'
        )
      );
  end if;
end $$;

commit;
