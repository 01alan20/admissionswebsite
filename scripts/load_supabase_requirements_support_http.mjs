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

const institutionsDir = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'institutions',
)

async function main() {
  // eslint-disable-next-line no-console
  console.log('Supabase URL:', supabaseUrl)
  // eslint-disable-next-line no-console
  console.log('Loading requirements and support notes from', institutionsDir)

  const files = fs.readdirSync(institutionsDir).filter((f) => f.endsWith('.json'))

  const reqRows = []
  const notesRows = []

  for (const file of files) {
    const raw = fs.readFileSync(path.join(institutionsDir, file), 'utf8')
    const data = JSON.parse(raw)

    const profile = data.profile || {}
    const unitid = Number(profile.unitid)
    if (!Number.isFinite(unitid)) continue

    const req = data.requirements || {}
    reqRows.push({
      unitid,
      test_policy: req.test_policy ?? null,
      required: Array.isArray(req.required) ? req.required : [],
      considered: Array.isArray(req.considered) ? req.considered : [],
      not_considered: Array.isArray(req.not_considered) ? req.not_considered : [],
    })

    const support = data.support_notes || {}
    if (support && typeof support === 'object') {
      for (const [key, value] of Object.entries(support)) {
        const text = String(value ?? '').trim()
        if (!text) continue
        notesRows.push({
          unitid,
          key: String(key),
          note: text,
        })
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Prepared ${reqRows.length} requirement rows and ${notesRows.length} support note rows`)

  if (reqRows.length > 0) {
    const pageSize = 500
    for (let i = 0; i < reqRows.length; i += pageSize) {
      const chunk = reqRows.slice(i, i + pageSize)
      // eslint-disable-next-line no-console
      console.log(`Requirements chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

      const { data: resp, error } = await supabase
        .from('institution_requirements')
        .upsert(chunk)
        .select('unitid')
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error upserting institution_requirements chunk:', error)
        process.exit(1)
      }
      // eslint-disable-next-line no-console
      console.log(`Requirements chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`)
    }
  }

  if (notesRows.length > 0) {
    const pageSize = 500
    for (let i = 0; i < notesRows.length; i += pageSize) {
      const chunk = notesRows.slice(i, i + pageSize)
      // eslint-disable-next-line no-console
      console.log(`Support notes chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

      const { data: resp, error } = await supabase
        .from('institution_support_notes')
        .upsert(chunk)
        .select('unitid, key')
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error upserting institution_support_notes chunk:', error)
        process.exit(1)
      }
      // eslint-disable-next-line no-console
      console.log(`Support notes chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`)
    }
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institution_requirements and institution_support_notes into Supabase via HTTP API.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading requirements/support notes:', err)
  process.exit(1)
})
