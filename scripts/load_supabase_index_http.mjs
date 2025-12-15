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
  // eslint-disable-next-line no-console
  console.log('Loading institutions_index from', institutionsPath)

  const text = fs.readFileSync(institutionsPath, 'utf8')
  const data = JSON.parse(text)

  const rows = data.map((d) => ({
    unitid: Number(d.unitid),
    name: d.name ?? null,
    city: d.city ?? null,
    state: d.state ?? null,
  }))

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for institutions_index`)

  const pageSize = 1000
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserting ${chunk.length} rows`)
    const { data: resp, error } = await supabase
      .from('institutions_index')
      .upsert(chunk)
      .select('unitid')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error upserting institutions_index chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(
      `Chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`,
    )
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institutions_index into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading institutions_index:', err)
  process.exit(1)
})

