# SeeThroughAdmissions

Modern, lightweight frontend for exploring US universities with filters, comparisons, and per‑school details.

Key features
- Explore: loads Top 10 by latest applicants, substring search (name/city/state) after 3+ letters, filter by Budget, Selectivity, Testing, Major, and State. Paginates 20 per page.
- Compare: select up to 3 schools; shows key stats, tuition, and median test scores (SAT EBRW, SAT Math, ACT Composite).
- Details: profile overview, admissions funnel, requirements, test score ranges, cost summary.

Tech stack
- Build: Vite + React (TypeScript in `geminibuild/`)
- Data: static JSON under `public/data/**` (consumed client‑side)
- Deploy: GitHub Pages via Actions (`.github/workflows/deploy-pages.yml`)

## Local development

Prereqs: Node 18+ (Node 20 recommended)

```
npm install
npm run dev
```

App entry is `index.html` which mounts `geminibuild/index.tsx`.

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
- Old `src/` app was removed; active app lives under `geminibuild/`.
