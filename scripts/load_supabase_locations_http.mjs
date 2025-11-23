import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

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

const csvPath = path.join(process.cwd(), 'public', 'data', 'uni_location_size.csv')

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)

  // Fetch existing institution ids to satisfy FK constraint
  const { data: instRows, error: instError } = await supabase
    .from('institutions')
    .select('unitid')
    .limit(10000)
  if (instError) {
    // eslint-disable-next-line no-console
    console.error('Error fetching institutions unitid list:', instError)
    process.exit(1)
  }
  const validIds = new Set((instRows || []).map((r) => r.unitid))
  // eslint-disable-next-line no-console
  console.log(`Loaded ${validIds.size} institution ids from Supabase`)

  // eslint-disable-next-line no-console
  console.log('Loading locations from', csvPath)

  const text = fs.readFileSync(csvPath, 'utf8')
  const records = parse(text, { columns: true, skip_empty_lines: true })

  const rows = records
    .filter((r) => r.unitid && validIds.has(Number(r.unitid)))
    .map((r) => ({
      unitid: Number(r.unitid),
      location_type: (r.UniLocation || '').trim() || null,
      location_size: (r.LocationSize || '').trim() || null,
      title_iv_indicator: (r['HD2024.Postsecondary and Title IV institution indicator'] || '').trim() || null,
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
