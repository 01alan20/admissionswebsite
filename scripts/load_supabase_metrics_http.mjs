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

const metricsPath = path.join(
  process.cwd(),
  'public',
  'data',
  'University_data',
  'metrics_by_year.json',
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

  // Build valid unitids from local institutions.json to avoid API row limits.
  const instText = fs.readFileSync(institutionsPath, 'utf8')
  const instData = JSON.parse(instText)
  const validIds = new Set(instData.map((d) => Number(d.unitid)).filter(Number.isFinite))
  // eslint-disable-next-line no-console
  console.log(`Loaded ${validIds.size} institution ids from ${institutionsPath}`)

  // eslint-disable-next-line no-console
  console.log('Loading metrics from', metricsPath)

  const text = fs.readFileSync(metricsPath, 'utf8')
  const data = JSON.parse(text)

  const rows = []
  for (const d of data) {
    const unitid = Number(d.unitid)
    const year = Number(d.year)
    if (!Number.isFinite(unitid) || !Number.isFinite(year) || !validIds.has(unitid)) continue

    rows.push({
      unitid,
      year,
      applicants_total: d.applicants_total ?? null,
      admissions_total: d.admissions_total ?? null,
      enrolled_total: d.enrolled_total ?? null,
      percent_admitted_total: d.percent_admitted_total ?? null,
      admissions_yield_total: d.admissions_yield_total ?? null,
      graduation_rate_bachelor_6yr: d.graduation_rate_bachelor_degree_within_6_years_total ?? null,
      full_time_retention_rate: d.full_time_retention_rate ?? null,
      student_to_faculty_ratio: d.student_to_faculty_ratio ?? null,
      total_enrollment: d.total_enrollment ?? null,
      sat_evidence_based_reading_and_writing_25th_percentile_score:
        d.sat_evidence_based_reading_and_writing_25th_percentile_score ?? null,
      sat_evidence_based_reading_and_writing_50th_percentile_score:
        d.sat_evidence_based_reading_and_writing_50th_percentile_score ?? null,
      sat_evidence_based_reading_and_writing_75th_percentile_score:
        d.sat_evidence_based_reading_and_writing_75th_percentile_score ?? null,
      sat_math_25th_percentile_score: d.sat_math_25th_percentile_score ?? null,
      sat_math_50th_percentile_score: d.sat_math_50th_percentile_score ?? null,
      sat_math_75th_percentile_score: d.sat_math_75th_percentile_score ?? null,
      act_composite_25th_percentile_score: d.act_composite_25th_percentile_score ?? null,
      act_composite_50th_percentile_score: d.act_composite_50th_percentile_score ?? null,
      act_composite_75th_percentile_score: d.act_composite_75th_percentile_score ?? null,
      act_english_25th_percentile_score: d.act_english_25th_percentile_score ?? null,
      act_english_50th_percentile_score: d.act_english_50th_percentile_score ?? null,
      act_english_75th_percentile_score: d.act_english_75th_percentile_score ?? null,
      act_math_25th_percentile_score: d.act_math_25th_percentile_score ?? null,
      act_math_50th_percentile_score: d.act_math_50th_percentile_score ?? null,
      act_math_75th_percentile_score: d.act_math_75th_percentile_score ?? null,
      sat_submitters_count:
        d.number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores ?? null,
      sat_submitters_percent:
        d.percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores ?? null,
      act_submitters_count:
        d.number_of_first_time_degree_certificate_seeking_students_submitting_act_scores ?? null,
      act_submitters_percent:
        d.percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores ?? null,
      percent_of_total_enrollment_that_are_u_s_nonresident:
        d.percent_of_total_enrollment_that_are_u_s_nonresident ?? null,
      admitted_est: d.admitted_est ?? null,
      enrolled_est: d.enrolled_est ?? null,
    })
  }

  // eslint-disable-next-line no-console
  console.log(`Prepared ${rows.length} rows for institution_metrics`)

  const pageSize = 500
  for (let i = 0; i < rows.length; i += pageSize) {
    const chunk = rows.slice(i, i + pageSize)
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: inserting ${chunk.length} rows`)

    const { data: resp, error } = await supabase
      .from('institution_metrics')
      .upsert(chunk)
      .select('unitid, year')
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Error upserting chunk:', error)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`Chunk ${i / pageSize + 1}: upserted rows reported=${resp ? resp.length : 0}`)
  }

  // eslint-disable-next-line no-console
  console.log('Finished loading institution_metrics into Supabase via HTTP API.')

  const { count, error: countError } = await supabase
    .from('institution_metrics')
    .select('unitid', { count: 'exact', head: true })
  if (countError) {
    // eslint-disable-next-line no-console
    console.warn('Unable to fetch row count for institution_metrics:', countError)
  } else {
    // eslint-disable-next-line no-console
    console.log(`institution_metrics row count now=${count}`)
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error loading institution_metrics:', err)
  process.exit(1)
})
