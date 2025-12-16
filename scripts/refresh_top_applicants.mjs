import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing SUPABASE_DB_URL or DATABASE_URL in .env.local.\n' +
      'Set DATABASE_URL to your Supabase Postgres connection string to run REFRESH MATERIALIZED VIEW.',
  )
  process.exit(1)
}

const client = postgres(connectionString, { ssl: 'require' })

async function main() {
  // eslint-disable-next-line no-console
  console.log('Refreshing materialized view public.top_applicants_latest...')
  await client.unsafe('refresh materialized view public.top_applicants_latest;')
  await client.end()
  // eslint-disable-next-line no-console
  console.log('Refresh complete.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error refreshing top_applicants_latest:', err)
  process.exit(1)
})

