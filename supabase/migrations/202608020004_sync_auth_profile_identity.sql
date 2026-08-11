-- GoodLivin Stage 1 corrective migration
-- Replace only placeholder profile identity fields with the matching Auth
-- account values. Scope, status, and all other profile data are preserved.
-- The existing profiles audit trigger records any changed rows.

begin;

update public.profiles as profile
set
  email = auth_user.email,
  display_name = coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(auth_user.email, 'GoodLivin user'), '@', 1)
  )
from auth.users as auth_user
where profile.user_id = auth_user.id
  and (
    profile.email like 'REPLACE_WITH_%'
    or profile.display_name like 'REPLACE_WITH_%'
  );

commit;
