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

const essaysPath = path.join(
  process.cwd(),
  'public',
  'data',
  'Applicant_Data',
  'Anonymous_Essays.json',
)

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)
  // eslint-disable-next-line no-console
  console.log('Loading anonymous essays from', essaysPath)

  const { count: existingCount, error: countError } = await supabase
    .from('anonymous_essays')
    .select('id', { count: 'exact', head: true })
  if (countError) {
    // eslint-disable-next-line no-console
    console.error('Error checking existing anonymous_essays rows:', countError)
    process.exit(1)
  }
  if ((existingCount ?? 0) > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `anonymous_essays already has ${existingCount} rows; skipping to avoid duplicates.`,
    )
    return
  }

  const text = fs.readFileSync(essaysPath, 'utf8')
  const data = JSON.parse(text)

  if (!Array.isArray(data) || data.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No essays found in file; skipping.')
    return
  }

  const rows = data
    .map((e) => {
      const school = e.school ?? null
      const year = Number.isFinite(Number(e.year)) ? Number(e.year) : null
      const type = e.type ?? null
      const category = e.category ?? null
      const prompt = e.question ?? null
      const essay = e.essay ?? null
      if (!essay) return null
      return {
        school,
        year,
        type,
        category,
        prompt,
        essay,
        major_codes: null,
        demographics: e.essay_id != null ? { source_essay_id: e.essay_id } : null,
      }
    })
    .filter(Boolean)

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for anonymous_essays`)

  const pageSize = 500
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)
    const { data: resp, error } = await supabase
      .from('anonymous_essays')
      .insert(chunk)
      .select('id')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error inserting anonymous_essays chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(
      `Chunk ${i / pageSize + 1}: inserted rows reported=${resp ? resp.length : 0}`,
    )
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading anonymous_essays into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading anonymous_essays:', err)
  process.exit(1)
})
