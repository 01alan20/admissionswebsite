-- Create the core profile table plus an auditable user event log.
-- Run this once in Supabase SQL Editor for the app project.

begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  demographics jsonb,
  academic_stats jsonb,
  extracurriculars jsonb,
  essay_drafts jsonb,
  target_universities integer[],
  university_predictions jsonb,
  admissions_scorecard jsonb,
  onboarding_step integer not null default 0
);

create table if not exists public.user_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create index if not exists user_events_user_created_idx
  on public.user_events (user_id, created_at desc);

create index if not exists user_events_event_type_idx
  on public.user_events (event_type);

create unique index if not exists user_events_registered_once_idx
  on public.user_events (user_id, event_type)
  where event_type = 'user_registered';

alter table public.profiles enable row level security;
alter table public.user_events enable row level security;

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Profiles: insert own" on public.profiles;
create policy "Profiles: insert own" on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own" on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Profiles: delete own" on public.profiles;
create policy "Profiles: delete own" on public.profiles
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "User events: read own" on public.user_events;
create policy "User events: read own" on public.user_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "User events: insert own" on public.user_events;
create policy "User events: insert own" on public.user_events
  for insert
  to authenticated
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert on public.user_events to authenticated;

insert into public.profiles (user_id)
select u.id
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

insert into public.user_events (user_id, event_type, source, metadata)
select
  u.id,
  'user_registered',
  'auth_backfill',
  jsonb_build_object(
    'email', u.email,
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email')
  )
from auth.users u
where not exists (
  select 1
  from public.user_events e
  where e.user_id = u.id
    and e.event_type = 'user_registered'
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_events (user_id, event_type, source, metadata)
  select
    new.id,
    'user_registered',
    'auth_trigger',
    jsonb_build_object(
      'email', new.email,
      'provider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')
    )
  where not exists (
    select 1
    from public.user_events e
    where e.user_id = new.id
      and e.event_type = 'user_registered'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

commit;
