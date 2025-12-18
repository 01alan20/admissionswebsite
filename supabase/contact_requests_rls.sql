-- Enable anonymous inserts for contact requests (so the frontend can store requests)
-- Apply in Supabase SQL editor for your project.

alter table public.contact_requests enable row level security;

drop policy if exists "public_insert_contact_requests" on public.contact_requests;
create policy "public_insert_contact_requests"
on public.contact_requests
for insert
to anon, authenticated
with check (true);

-- Do NOT enable public select/update by default.
-- Your daily digest job should use the service role key to read/update rows.

