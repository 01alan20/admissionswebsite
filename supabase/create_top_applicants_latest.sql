-- Build or rebuild the materialized view used to rank institutions by applicants.
-- Run this in Supabase -> SQL Editor.

begin;

drop materialized view if exists public.top_applicants_latest;

create materialized view public.top_applicants_latest as
select
  unitid,
  year,
  applicants_total
from (
  select
    m.unitid,
    m.year,
    m.applicants_total,
    row_number() over (partition by m.unitid order by m.year desc) as rn
  from public.institution_metrics m
  where m.applicants_total is not null
) latest
where latest.rn = 1;

create unique index if not exists top_applicants_latest_unitid_idx
  on public.top_applicants_latest (unitid);

create index if not exists top_applicants_latest_applicants_total_idx
  on public.top_applicants_latest (applicants_total desc nulls last);

-- Expose to the API (PostgREST schema cache depends on privileges).
grant select on public.top_applicants_latest to anon, authenticated;

commit;

-- Optional: refresh after bulk loads
-- refresh materialized view public.top_applicants_latest;

