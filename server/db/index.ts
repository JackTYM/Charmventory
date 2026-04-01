import { neon } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let _db: NeonHttpDatabase<typeof schema> | null = null

export function useDb() {
  if (!_db) {
    const config = useRuntimeConfig()
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL not configured')
    }
    const sql = neon(config.databaseUrl)
    _db = drizzle(sql, { schema })
  }
  return _db
}

// Legacy export for compatibility - will be lazy initialized on first use
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_, prop) {
    return useDb()[prop as keyof NeonHttpDatabase<typeof schema>]
  }
})

export * from './schema'
