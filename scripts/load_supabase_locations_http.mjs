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

const locationsJsonPath = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'uni_location_size.json',
)
const institutionsPath = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'institutions.json',
)

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)

  if (!fs.existsSync(locationsJsonPath)) {
    // eslint-disable-next-line no-console
    console.warn(
      'Location dataset not found at',
      locationsJsonPath,
      '\nSkipping institution_locations load (table will remain empty).',
    )
    return
  }

  // Build valid unitids from local institutions.json to avoid API row limits.
  const instText = fs.readFileSync(institutionsPath, 'utf8')
  const instData = JSON.parse(instText)
  const validIds = new Set(instData.map((d) => Number(d.unitid)).filter(Number.isFinite))
  // eslint-disable-next-line no-console
  console.log(`Loaded ${validIds.size} institution ids from ${institutionsPath}`)

  // eslint-disable-next-line no-console
  console.log('Loading locations from', locationsJsonPath)

  const text = fs.readFileSync(locationsJsonPath, 'utf8')
  const records = JSON.parse(text)
  const rows = (Array.isArray(records) ? records : [])
    .filter((r) => r && r.unitid && validIds.has(Number(r.unitid)))
    .map((r) => ({
      unitid: Number(r.unitid),
      location_type: (r.location || '').trim() || null,
      location_size: (r.size || '').trim() || null,
      title_iv_indicator: null,
    }))

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for institution_locations`)

  const pageSize = 500
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

    const { data, error } = await supabase
      .from('institution_locations')
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
  console.log('Finished loading institution_locations into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading institution_locations:', err)
  process.exit(1)
})
