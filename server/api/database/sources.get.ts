import { db } from '../../db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const result = await db.execute(sql`
    SELECT scraped_by as id, COUNT(*) as count
    FROM charm_sightings
    WHERE scraped_by IS NOT NULL
    GROUP BY scraped_by
    ORDER BY count DESC
  `)

  const sources = (result.rows as any[]).map(row => ({
    id: row.id,
    name: row.id
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    count: parseInt(row.count),
  }))

  return { data: sources }
})
