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

const majorsMetaPath = path.join(process.cwd(), 'public', 'data', 'majors_bachelor_meta.json')
const majorsByInstPath = path.join(process.cwd(), 'public', 'data', 'majors_bachelor_by_institution.json')

async function loadMajorsMeta() {
  // eslint-disable-next-line no-console
  console.log('Loading majors meta from', majorsMetaPath)
  const text = fs.readFileSync(majorsMetaPath, 'utf8')
  const data = JSON.parse(text)

  const rows = []
  const levels = [
    ['two_digit', '2-digit'],
    ['four_digit', '4-digit'],
    ['six_digit', '6-digit'],
  ]

  for (const [key, levelLabel] of levels) {
    const mapping = data[key]
    if (!mapping || typeof mapping !== 'object') continue
    for (const [code, title] of Object.entries(mapping)) {
      if (!code) continue
      const t = String(title ?? '').trim()
      if (!t) continue
      rows.push({
        cip_code: String(code),
        cip_level: levelLabel,
        title: t,
      })
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for majors_meta`)

  const { data: resp, error } = await supabase.from('majors_meta').upsert(rows).select('cip_code')
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Error upserting majors_meta:', error)
    process.exit(1)
  }
  // eslint-disable-next-line no-console
  console.log(`Upserted majors_meta rows reported=${resp ? resp.length : 0}`)
}

async function loadInstitutionMajors() {
  // eslint-disable-next-line no-console
  console.log('Loading institution majors from', majorsByInstPath)

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
  const text = fs.readFileSync(majorsByInstPath, 'utf8')
  const data = JSON.parse(text)

  const rows = []
  for (const [unitidStr, entry] of Object.entries(data)) {
    const unitid = Number(unitidStr)
    if (!Number.isFinite(unitid) || !validIds.has(unitid) || !entry || typeof entry !== 'object') continue

    const { two_digit = [], four_digit = [], six_digit = [] } = entry

    for (const code of two_digit) {
      if (!code) continue
      rows.push({ unitid, cip_level: '2-digit', cip_code: String(code) })
    }
    for (const code of four_digit) {
      if (!code) continue
      rows.push({ unitid, cip_level: '4-digit', cip_code: String(code) })
    }
    for (const code of six_digit) {
      if (!code) continue
      rows.push({ unitid, cip_level: '6-digit', cip_code: String(code) })
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for institution_majors`)

  const pageSize = 1000
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

    const { data: resp, error } = await supabase
      .from('institution_majors')
      .upsert(chunk)
      .select('unitid, cip_code')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error upserting institution_majors chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`)
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institution_majors into Supabase via HTTP API.')
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)
  await loadMajorsMeta()
  await loadInstitutionMajors()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading majors data:', err)
  process.exit(1)
})
