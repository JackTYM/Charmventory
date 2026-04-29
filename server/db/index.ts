import { neon } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let _db: NeonHttpDatabase<typeof schema> | null = null

function getDatabaseUrl(): string {
  // First try environment variable (for scripts/workers)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // Then try Nuxt runtime config (for Nuxt server routes)
  try {
    const config = useRuntimeConfig()
    if (config.databaseUrl) {
      return config.databaseUrl
    }
  } catch {
    // useRuntimeConfig not available outside Nuxt
  }

  throw new Error('DATABASE_URL not configured')
}

export function useDb() {
  if (!_db) {
    const databaseUrl = getDatabaseUrl()
    const sql = neon(databaseUrl)
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
