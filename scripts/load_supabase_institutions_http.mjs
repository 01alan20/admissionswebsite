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
      'Go to Supabase → Project Settings → API and copy the project URL and service role key.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const rootDir = path.resolve(process.cwd())
const institutionsPath = path.join(
  rootDir,
  'public',
  'data',
  'University_data',
  'institutions.json',
)

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)
  // eslint-disable-next-line no-console
  console.log('Loading institutions from', institutionsPath)

  const text = fs.readFileSync(institutionsPath, 'utf8')
  const data = JSON.parse(text)

  const rows = data.map((d) => ({
    unitid: Number(d.unitid),
    name: d.name ?? null,
    city: d.city ?? null,
    state: d.state ?? null,
    control: d.control ?? null,
    level: d.level ?? null,
    carnegie_basic: d.carnegie_basic ?? null,
    acceptance_rate: d.acceptance_rate ?? null,
    yield: d.yield ?? null,
    tuition_2023_24: d.tuition_2023_24 ?? null,
    tuition_2023_24_in_state: d.tuition_2023_24_in_state ?? null,
    tuition_2023_24_out_of_state: d.tuition_2023_24_out_of_state ?? null,
    grad_rate_6yr: d.grad_rate_6yr ?? null,
    intl_enrollment_pct: d.intl_enrollment_pct ?? null,
    full_time_retention_rate: d.full_time_retention_rate ?? null,
    student_to_faculty_ratio: d.student_to_faculty_ratio ?? null,
    total_enrollment: d.total_enrollment ?? null,
    website: d.website ?? null,
    admissions_url: d.admissions_url ?? null,
    financial_aid_url: d.financial_aid_url ?? null,
    application_url: d.application_url ?? null,
    test_policy: d.test_policy ?? null,
    major_families: d.major_families ?? [],
  }))

  const pageSize = 500
  // eslint-disable-next-line no-console
  console.log(`Upserting ${rows.length} institutions into Supabase...`)

  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

    const { data, error } = await supabase
      .from('institutions')
      .upsert(chunk)
      .select('unitid')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error upserting chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserted rows reported=${data ? data.length : 0}`)
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institutions into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading institutions:', err)
  process.exit(1)
})
