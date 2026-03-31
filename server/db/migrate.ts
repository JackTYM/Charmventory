import { Pool } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

  // Read the migration file
  const migrationPath = join(__dirname, 'migrations/0000_medical_frog_thor.sql')
  const migrationSql = readFileSync(migrationPath, 'utf-8')

  // Split by statement breakpoint and execute each
  const statements = migrationSql.split('--> statement-breakpoint')

  console.log(`Running ${statements.length} migration statements...`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt) continue

    try {
      await pool.query(stmt)
      console.log(`✓ Statement ${i + 1}/${statements.length}`)
    } catch (e: any) {
      // Ignore "already exists" errors
      if (e.message?.includes('already exists') || e.code === '42710' || e.code === '42P07') {
        console.log(`⚠ Statement ${i + 1}/${statements.length} - already exists, skipping`)
      } else {
        console.error(`✗ Statement ${i + 1}/${statements.length} failed:`, e.message)
        console.error('SQL:', stmt.substring(0, 100) + '...')
      }
    }
  }

  await pool.end()
  console.log('Migration complete!')
}

migrate().catch(console.error)
