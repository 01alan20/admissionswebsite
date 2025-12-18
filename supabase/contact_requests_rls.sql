-- Enable private storage for contact requests while still allowing public inserts.
-- Run this in the Supabase SQL editor for your project.

alter table public.contact_requests enable row level security;

drop policy if exists "public_insert_contact_requests" on public.contact_requests;
create policy "public_insert_contact_requests"
on public.contact_requests
for insert
to anon, authenticated
with check (true);

-- Intentionally no public select/update/delete policies.
-- Use Supabase Studio (as an admin) or a server job (service role) to read rows.

