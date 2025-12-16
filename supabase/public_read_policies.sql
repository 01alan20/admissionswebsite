-- Public read access for reference datasets
-- Run this in Supabase -> SQL Editor for the project used by the app.
--
-- These tables contain non-sensitive, public university/reference data.
-- Without these policies, the `anon` key may return 0 rows due to RLS.

begin;

grant usage on schema public to anon, authenticated;

-- Helper: set up a simple "allow read" policy and grants.
-- Note: Supabase SQL editor does not support creating reusable macros easily,
-- so we repeat statements table-by-table for clarity.

-- institutions
alter table public.institutions enable row level security;
drop policy if exists "Public read" on public.institutions;
create policy "Public read" on public.institutions
  for select to anon, authenticated
  using (true);
grant select on public.institutions to anon, authenticated;

-- institutions_index
alter table public.institutions_index enable row level security;
drop policy if exists "Public read" on public.institutions_index;
create policy "Public read" on public.institutions_index
  for select to anon, authenticated
  using (true);
grant select on public.institutions_index to anon, authenticated;

-- majors_meta
alter table public.majors_meta enable row level security;
drop policy if exists "Public read" on public.majors_meta;
create policy "Public read" on public.majors_meta
  for select to anon, authenticated
  using (true);
grant select on public.majors_meta to anon, authenticated;

-- institution_majors
alter table public.institution_majors enable row level security;
drop policy if exists "Public read" on public.institution_majors;
create policy "Public read" on public.institution_majors
  for select to anon, authenticated
  using (true);
grant select on public.institution_majors to anon, authenticated;

-- institution_metrics
alter table public.institution_metrics enable row level security;
drop policy if exists "Public read" on public.institution_metrics;
create policy "Public read" on public.institution_metrics
  for select to anon, authenticated
  using (true);
grant select on public.institution_metrics to anon, authenticated;

-- institution_demographics
alter table public.institution_demographics enable row level security;
drop policy if exists "Public read" on public.institution_demographics;
create policy "Public read" on public.institution_demographics
  for select to anon, authenticated
  using (true);
grant select on public.institution_demographics to anon, authenticated;

-- institution_locations (optional, if/when loaded)
alter table public.institution_locations enable row level security;
drop policy if exists "Public read" on public.institution_locations;
create policy "Public read" on public.institution_locations
  for select to anon, authenticated
  using (true);
grant select on public.institution_locations to anon, authenticated;

-- institution_requirements (optional, if/when loaded)
alter table public.institution_requirements enable row level security;
drop policy if exists "Public read" on public.institution_requirements;
create policy "Public read" on public.institution_requirements
  for select to anon, authenticated
  using (true);
grant select on public.institution_requirements to anon, authenticated;

-- institution_support_notes (optional, if/when loaded)
alter table public.institution_support_notes enable row level security;
drop policy if exists "Public read" on public.institution_support_notes;
create policy "Public read" on public.institution_support_notes
  for select to anon, authenticated
  using (true);
grant select on public.institution_support_notes to anon, authenticated;

-- top_applicants_latest (materialized view used for ordering)
alter table public.top_applicants_latest enable row level security;
drop policy if exists "Public read" on public.top_applicants_latest;
create policy "Public read" on public.top_applicants_latest
  for select to anon, authenticated
  using (true);
grant select on public.top_applicants_latest to anon, authenticated;

-- Optional content tables (if/when loaded)
alter table public.anonymous_essays enable row level security;
drop policy if exists "Public read" on public.anonymous_essays;
create policy "Public read" on public.anonymous_essays
  for select to anon, authenticated
  using (true);
grant select on public.anonymous_essays to anon, authenticated;

alter table public.success_app_profiles enable row level security;
drop policy if exists "Public read" on public.success_app_profiles;
create policy "Public read" on public.success_app_profiles
  for select to anon, authenticated
  using (true);
grant select on public.success_app_profiles to anon, authenticated;

commit;

