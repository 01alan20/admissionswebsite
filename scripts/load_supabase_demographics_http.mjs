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

const csvPath = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'uni_demographics.csv',
)

const institutionsPath = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'institutions.json',
)

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function toNumberOrNull(value) {
  if (value == null) return null
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

const DEMOGRAPHIC_COLUMNS = [
  {
    key: 'american_indian_or_alaska_native',
    header: 'EFFY2024.American Indian or Alaska Native total',
  },
  { key: 'asian', header: 'EFFY2024.Asian total' },
  { key: 'black_or_african_american', header: 'EFFY2024.Black or African American total' },
  { key: 'hispanic_or_latino', header: 'EFFY2024.Hispanic or Latino total' },
  {
    key: 'native_hawaiian_or_pacific_islander',
    header: 'EFFY2024.Native Hawaiian or Other Pacific Islander total',
  },
  { key: 'white', header: 'EFFY2024.White total' },
  { key: 'two_or_more_races', header: 'EFFY2024.Two or more races total' },
  { key: 'unknown', header: 'EFFY2024.Race/ethnicity unknown total' },
  { key: 'nonresident', header: 'EFFY2024.U.S. Nonresident total' },
]

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)

  if (!fs.existsSync(csvPath)) {
    // eslint-disable-next-line no-console
    console.error('Demographics CSV not found at', csvPath)
    process.exit(1)
  }

  // Build valid unitids from local institutions.json to avoid API row limits.
  const instText = fs.readFileSync(institutionsPath, 'utf8')
  const instData = JSON.parse(instText)
  const validIds = new Set(instData.map((d) => Number(d.unitid)).filter(Number.isFinite))
  // eslint-disable-next-line no-console
  console.log(`Loaded ${validIds.size} institution ids from ${institutionsPath}`)

  // eslint-disable-next-line no-console
  console.log('Loading demographics from', csvPath)

  const csvText = fs.readFileSync(csvPath, 'utf8')
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length <= 1) {
    // eslint-disable-next-line no-console
    console.warn('Demographics CSV appears empty; skipping.')
    return
  }

  const headerCols = parseCsvLine(lines[0])
  const headerLookup = new Map()
  headerCols.forEach((h, idx) => headerLookup.set(String(h).trim().toLowerCase(), idx))
  const getIdx = (name) => headerLookup.get(String(name).toLowerCase()) ?? -1

  const unitidIdx = getIdx('unitid')
  const yearIdx = getIdx('year')
  const levelIdx = getIdx('effy2024.level and degree/certificate-seeking status of student')
  const ugGradIdx = getIdx('effy2024.undergraduate or graduate level of student')
  const totalIdx = getIdx('effy2024.grand total')
  const menIdx = getIdx('effy2024.grand total men')
  const womenIdx = getIdx('effy2024.grand total women')

  if (unitidIdx === -1 || totalIdx === -1) {
    // eslint-disable-next-line no-console
    console.error('Demographics CSV missing required columns (unitid and/or total).')
    process.exit(1)
  }

  const columnIndexByKey = {}
  for (const col of DEMOGRAPHIC_COLUMNS) {
    columnIndexByKey[col.key] = getIdx(col.header)
  }

  // Keep latest-year row per unitid
  const latestByUnit = new Map()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length <= Math.max(unitidIdx, totalIdx)) continue

    const levelRaw = levelIdx !== -1 ? String(cols[levelIdx] ?? '').trim().toLowerCase() : ''
    const levelType = ugGradIdx !== -1 ? String(cols[ugGradIdx] ?? '').trim().toLowerCase() : ''
    const isUndergradRow =
      levelRaw.includes('all students, undergraduate total') ||
      (levelType === 'undergraduate' && levelRaw.includes('undergraduate'))
    if (!isUndergradRow) continue

    const unitid = Number(cols[unitidIdx])
    if (!Number.isFinite(unitid) || !validIds.has(unitid)) continue

    const total = toNumberOrNull(cols[totalIdx])
    if (total == null || total <= 0) continue

    const yearVal = yearIdx !== -1 ? Number(cols[yearIdx]) : NaN
    const year = Number.isFinite(yearVal) ? yearVal : null

    const totalMen = menIdx !== -1 ? toNumberOrNull(cols[menIdx]) : null
    const totalWomen = womenIdx !== -1 ? toNumberOrNull(cols[womenIdx]) : null

    const entry = { unitid, year, total, totalMen, totalWomen, cols }
    const existing = latestByUnit.get(unitid)
    if (!existing || (year ?? -Infinity) > (existing.year ?? -Infinity)) {
      latestByUnit.set(unitid, entry)
    }
  }

  const rows = []
  for (const entry of latestByUnit.values()) {
    const { unitid, year, total, totalMen, totalWomen, cols } = entry
    for (const col of DEMOGRAPHIC_COLUMNS) {
      const idx = columnIndexByKey[col.key]
      const count = idx != null && idx >= 0 ? toNumberOrNull(cols[idx]) : null
      const percent = count != null ? (count / total) * 100 : null
      rows.push({
        unitid,
        year,
        total_undergrad: total,
        total_undergrad_men: totalMen,
        total_undergrad_women: totalWomen,
        group_key: col.key,
        count,
        percent,
      })
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for institution_demographics`)

  const pageSize = 1000
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserting ${chunk.length} rows`)
    const { data, error } = await supabase
      .from('institution_demographics')
      .upsert(chunk)
      .select('unitid, group_key')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error upserting chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserted rows reported=${data ? data.length : 0}`)
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institution_demographics into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading institution_demographics:', err)
  process.exit(1)
})
