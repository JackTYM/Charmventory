import { db } from '../../../../db'
import { catalogs, catalogRevisions } from '../../../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const revisionId = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!revisionId) {
    throw createError({
      statusCode: 400,
      message: 'Missing revision ID',
    })
  }

  const { action, reviewNote, reviewedBy } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    throw createError({
      statusCode: 400,
      message: 'Action must be "approve" or "reject"',
    })
  }

  // Get the revision
  const [revision] = await db
    .select()
    .from(catalogRevisions)
    .where(eq(catalogRevisions.id, revisionId))

  if (!revision) {
    throw createError({
      statusCode: 404,
      message: 'Revision not found',
    })
  }

  // Update revision status
  const [updatedRevision] = await db
    .update(catalogRevisions)
    .set({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: reviewedBy || null,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    })
    .where(eq(catalogRevisions.id, revisionId))
    .returning()

  // If approved, set as current revision for the catalog
  if (action === 'approve') {
    await db
      .update(catalogs)
      .set({
        currentRevisionId: revisionId,
        updatedAt: new Date(),
      })
      .where(eq(catalogs.id, revision.catalogId))
  }

  return updatedRevision
})
