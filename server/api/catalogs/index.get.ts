import { db } from '../../db'
import { catalogs, catalogRevisions } from '../../db/schema'
import { desc, eq, and, SQL } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { year, season, region } = query

  const conditions: SQL[] = []

  if (year) {
    conditions.push(eq(catalogs.year, Number(year)))
  }

  if (season) {
    conditions.push(eq(catalogs.season, season as string))
  }

  if (region) {
    conditions.push(eq(catalogs.region, region as string))
  }

  let catalogList
  if (conditions.length > 0) {
    catalogList = await db
      .select()
      .from(catalogs)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(catalogs.year), desc(catalogs.createdAt))
  } else {
    catalogList = await db
      .select()
      .from(catalogs)
      .orderBy(desc(catalogs.year), desc(catalogs.createdAt))
  }

  // Fetch current revision for each catalog
  const result = await Promise.all(
    catalogList.map(async (catalog) => {
      let currentRevision = null
      if (catalog.currentRevisionId) {
        [currentRevision] = await db
          .select()
          .from(catalogRevisions)
          .where(eq(catalogRevisions.id, catalog.currentRevisionId))
      }
      return {
        ...catalog,
        currentRevision,
      }
    })
  )

  return result
})
