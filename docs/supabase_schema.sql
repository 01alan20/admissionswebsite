-- Table to store onboarding responses keyed by auth user id
create table if not exists public.onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gpa_type text not null check (gpa_type in ('Weighted GPA','Unweighted GPA','None')),
  gpa_value numeric,
  curriculum text not null,
  sat_total int,
  sat_math int,
  act_composite int,
  majors text[] not null default '{}',
  target_states text[] not null default '{}',
  target_cities text[] not null default '{}',
  campus_setting text,
  university_size text,
  university_types text[] not null default '{}',
  financial_aid_need text,
  completed_at timestamptz
);

-- Requests for extra help (for later notifications or automation)
create table if not exists public.help_requests (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  choices text[] not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.onboarding enable row level security;
alter table public.help_requests enable row level security;

create policy "onboarding self access" on public.onboarding
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "help_requests self insert" on public.help_requests
  for insert with check (true);
create policy "help_requests self read" on public.help_requests
  for select using (auth.uid() = user_id);

