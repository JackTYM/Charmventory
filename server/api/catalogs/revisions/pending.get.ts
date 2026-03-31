import { db } from '../../../db'
import { catalogs, catalogRevisions } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  // Get all pending revisions with catalog info
  const pendingRevisions = await db
    .select({
      revision: catalogRevisions,
      catalog: {
        id: catalogs.id,
        year: catalogs.year,
        season: catalogs.season,
        region: catalogs.region,
      },
    })
    .from(catalogRevisions)
    .innerJoin(catalogs, eq(catalogRevisions.catalogId, catalogs.id))
    .where(eq(catalogRevisions.status, 'pending'))
    .orderBy(desc(catalogRevisions.createdAt))

  return pendingRevisions.map((r) => ({
    ...r.revision,
    catalog: r.catalog,
  }))
})
