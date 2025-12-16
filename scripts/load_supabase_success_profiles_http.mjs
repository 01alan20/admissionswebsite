import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      'Go to Supabase -> Project Settings -> API and copy the project URL and service role key.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const profilesPath = path.join(
  process.cwd(),
  'public',
  'data',
  'Applicant_Data',
  'history_success_profiles.json',
)

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)
  // eslint-disable-next-line no-console
  console.log('Loading success_app_profiles from', profilesPath)

  const { count: existingCount, error: countError } = await supabase
    .from('success_app_profiles')
    .select('id', { count: 'exact', head: true })
  if (countError) {
    // eslint-disable-next-line no-console
    console.error('Error checking existing success_app_profiles rows:', countError)
    process.exit(1)
  }
  if ((existingCount ?? 0) > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `success_app_profiles already has ${existingCount} rows; skipping to avoid duplicates.`,
    )
    return
  }

  const text = fs.readFileSync(profilesPath, 'utf8')
  const data = JSON.parse(text)

  if (!Array.isArray(data) || data.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No profiles found in file; skipping.')
    return
  }

  const rows = data
    .map((p) => {
      const year = Number.isFinite(Number(p.year)) ? Number(p.year) : null
      const flair = Array.isArray(p.flair) ? p.flair : []
      const demographics = p.demographics ?? null
      const academics = p.academics ?? null
      const extracurriculars = p.extracurricular_activities ?? p.extracurriculars ?? null
      const awards = p.awards ?? null
      const decisions = p.decisions ?? null
      const major_codes = null

      const sourceId = p.id ?? null

      return {
        year,
        flair,
        demographics:
          sourceId != null && demographics && typeof demographics === 'object'
            ? { ...demographics, source_profile_id: sourceId }
            : sourceId != null
              ? { source_profile_id: sourceId }
              : demographics,
        academics,
        extracurriculars,
        awards,
        decisions,
        major_codes,
      }
    })
    .filter(Boolean)

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for success_app_profiles`)

  const pageSize = 250
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)
    const { data: resp, error } = await supabase
      .from('success_app_profiles')
      .insert(chunk)
      .select('id')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error inserting success_app_profiles chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(
      `Chunk ${i / pageSize + 1}: inserted rows reported=${resp ? resp.length : 0}`,
    )
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading success_app_profiles into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading success_app_profiles:', err)
  process.exit(1)
})
