# SeeThroughAdmissions

Modern, lightweight frontend for exploring US universities with filters, comparisons, and per‑school details.

Key features
- Explore: loads Top 10 by latest applicants, substring search (name/city/state) after 3+ letters, filter by Budget, Selectivity, Testing, Major, and State. Paginates 20 per page.
- Compare: select up to 3 schools; shows key stats, tuition, and median test scores (SAT EBRW, SAT Math, ACT Composite).
- Details: profile overview, admissions funnel, requirements, test score ranges, cost summary.

Tech stack
- Build: Vite + React (TypeScript in `frontend/`)
- Data: static JSON under `public/data/**` (consumed client‑side)
- Deploy: GitHub Pages via Actions (`.github/workflows/deploy-pages.yml`)

## Local development

Prereqs: Node 18+ (Node 20 recommended)

```
npm install
npm run dev
```

App entry is `index.html` which mounts `frontend/index.tsx`.

## Build

```
npm run build
npm run preview   # optional local preview of dist/
```

## Deployment (GitHub Pages)

Pushes to `master` build with Vite and publish `dist/` automatically.
- Workflow: `.github/workflows/deploy-pages.yml`
- Pages settings: set Source = GitHub Actions.
- For project pages (https://<user>.github.io/<repo>/) the workflow sets the Vite base path so assets load correctly.

## Contact form (private + emailed)

GitHub Pages is static, so "Contact" submissions cannot be stored in this repo without becoming public.
Instead, the app stores contact requests in Supabase and a GitHub Action forwards new requests to email.

- Frontend page: `frontend/pages/ContactPage.tsx` (route: `#/contact`)
- Storage table: `public.contact_requests` (Supabase)
- RLS policy to allow public inserts: `supabase/contact_requests_rls.sql`
- Email forwarder (runs every 15 minutes): `.github/workflows/contact-requests-email.yml`

**One-time Supabase setup**
- Create the `contact_requests` table (or confirm it already exists in your project).
- Run `supabase/contact_requests_rls.sql` in the Supabase SQL editor to ensure:
  - Anonymous `insert` is allowed.
  - Public `select` is not allowed (keeps requests private).

**GitHub Actions secrets (Repo Settings → Secrets and variables → Actions)**
- `SUPABASE_URL` (e.g. `https://xxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` (service role key from Supabase)
- `GMAIL_USERNAME` (sending Gmail address)
- `GMAIL_APP_PASSWORD` (Google “App password” for that Gmail account)
- `CONTACT_EMAIL_TO` (where you want requests delivered)
- Optional: `CONTACT_EMAIL_FROM` (defaults to `GMAIL_USERNAME`)

## Data files and privacy

This site fetches data at runtime from `public/data/**` (e.g., `/data/institutions.json`, `/data/institutions/<unitid>.json`).

- Public Pages deployments must include these JSON files so the client can load them. If you need to hide data, options are:
  - Host data on a private API/backend and fetch from there (requires enabling CORS and possibly auth). GitHub Pages cannot host private API code.
  - Deploy on a platform with serverless functions (e.g., Netlify/Vercel) and proxy data from private storage.
  - Keep the repository private (subject to GitHub plan limitations) and deploy Pages from private repos if supported.

## Repo hygiene

Ignored files (see `.gitignore`):
- `assessment scores - guide.docx` (local document, not uploaded)
- Local env files: `.env`, `.env.*`
- Build artifacts: `dist/`
- Node modules, editor files, local Netlify folder, logs

## Notes

- AI (Gemini) features are disabled; no API key required.
- Old `src/` app was removed; active app lives under `frontend/`.
