import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const rootDir = path.resolve(process.cwd())
const sqlFilePath = path.join(rootDir, 'data_pipeline', 'supabase_institutions.sql')

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing SUPABASE_DB_URL or DATABASE_URL. Set one in .env.local with your Supabase Postgres connection string.',
  )
  process.exit(1)
}

const client = postgres(connectionString, { ssl: 'require' })

async function main() {
  // eslint-disable-next-line no-console
  console.log('Loading SQL from', sqlFilePath)

  const sqlText = fs.readFileSync(sqlFilePath, 'utf8')

  // eslint-disable-next-line no-console
  console.log('Running INSERT statements against Supabase...')
  await client.unsafe(sqlText)

  await client.end()
  // eslint-disable-next-line no-console
  console.log('Finished loading institutions into Supabase.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error loading institutions into Supabase:', err)
  process.exit(1)
})
