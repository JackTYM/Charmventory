import { db } from '../../../db'
import { catalogRevisions } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const catalogId = getRouterParam(event, 'id')

  if (!catalogId) {
    throw createError({
      statusCode: 400,
      message: 'Missing catalog ID',
    })
  }

  const revisions = await db
    .select()
    .from(catalogRevisions)
    .where(eq(catalogRevisions.catalogId, catalogId))
    .orderBy(desc(catalogRevisions.createdAt))

  return revisions
})
