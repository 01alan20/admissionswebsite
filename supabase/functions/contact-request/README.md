# contact-request (Supabase Edge Function)

Stores a contact request in `public.contact_requests` and emails it to you (server-side), so the user does not need to send an email themselves.

## Required Supabase secrets

Set these in the Supabase dashboard (Project Settings → Functions → Secrets):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Email (Resend) secrets (recommended)

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL` (your inbox)
- `CONTACT_FROM_EMAIL` (a verified sender in Resend, e.g. `SeeThrough Admissions <no-reply@yourdomain.com>`)

If the email secrets are not set, the function still stores the request but returns `"emailed": false`.

## Deploy

Using the Supabase CLI:

1. `supabase login`
2. `supabase link --project-ref bwwgssljkdvqojcaxrqf`
3. `supabase functions deploy contact-request`

