import { spawnSync } from 'node:child_process'

const steps = [
  ['institutions', 'scripts/load_supabase_institutions_http.mjs'],
  ['institutions_index', 'scripts/load_supabase_index_http.mjs'],
  ['majors', 'scripts/load_supabase_majors_http.mjs'],
  ['metrics', 'scripts/load_supabase_metrics_http.mjs'],
  ['locations', 'scripts/load_supabase_locations_http.mjs'],
  ['demographics', 'scripts/load_supabase_demographics_http.mjs'],
  ['requirements_support', 'scripts/load_supabase_requirements_support_http.mjs'],
  ['anonymous_essays', 'scripts/load_supabase_essays_http.mjs'],
  ['success_profiles', 'scripts/load_supabase_success_profiles_http.mjs'],
]

for (const [label, script] of steps) {
  // eslint-disable-next-line no-console
  console.log(`\n=== Loading ${label} (${script}) ===`)
  const res = spawnSync(process.execPath, [script], { stdio: 'inherit' })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

// eslint-disable-next-line no-console
console.log(
  '\nAll loads finished.\n' +
    'Next: run `refresh materialized view public.top_applicants_latest;` in Supabase SQL editor (after metrics are loaded).',
)
