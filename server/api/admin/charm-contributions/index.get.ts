import { db } from '../../../db'
import { charmContributions } from '../../../db/schema'
import { getUserFromRequest } from '../../../utils/auth'
import { eq, desc } from 'drizzle-orm'

const ADMIN_EMAIL = 'jacksonkyarger@gmail.com'

export default defineEventHandler(async (event) => {
  const auth = await getUserFromRequest(event)

  if (!auth || auth.email !== ADMIN_EMAIL) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const contributions = await db
    .select({
      id: charmContributions.id,
      styleId: charmContributions.styleId,
      contributionType: charmContributions.contributionType,
      field: charmContributions.field,
      oldValue: charmContributions.oldValue,
      newValue: charmContributions.newValue,
      imageUrl: charmContributions.imageUrl,
      notes: charmContributions.notes,
      contributedBy: charmContributions.contributedBy,
      status: charmContributions.status,
      createdAt: charmContributions.createdAt,
    })
    .from(charmContributions)
    .where(eq(charmContributions.status, 'pending'))
    .orderBy(desc(charmContributions.createdAt))

  return contributions
})
