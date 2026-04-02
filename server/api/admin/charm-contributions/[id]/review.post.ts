import { db } from '../../../../db'
import { charmContributions, charmDatabase, charmImages } from '../../../../db/schema'
import { getUserFromRequest } from '../../../../utils/auth'
import { eq } from 'drizzle-orm'

const ADMIN_EMAIL = 'jacksonkyarger@gmail.com'

export default defineEventHandler(async (event) => {
  const auth = await getUserFromRequest(event)
  
  if (!auth || auth.email !== ADMIN_EMAIL) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const contributionId = getRouterParam(event, 'id')
  if (!contributionId) {
    throw createError({
      statusCode: 400,
      message: 'Contribution ID required',
    })
  }

  const body = await readBody(event)
  const { action, reviewNotes } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    throw createError({
      statusCode: 400,
      message: 'Action must be approve or reject',
    })
  }

  const [contribution] = await db
    .select()
    .from(charmContributions)
    .where(eq(charmContributions.id, contributionId))
    .limit(1)

  if (!contribution) {
    throw createError({
      statusCode: 404,
      message: 'Contribution not found',
    })
  }

  if (contribution.status !== 'pending') {
    throw createError({
      statusCode: 400,
      message: 'Contribution already reviewed',
    })
  }

  if (action === 'approve') {
    const charmData = contribution.newValue ? JSON.parse(contribution.newValue) : {}
    
    const existingCharm = await db
      .select()
      .from(charmDatabase)
      .where(eq(charmDatabase.styleId, contribution.styleId))
      .limit(1)

    const existing = existingCharm[0]

    if (existing) {
      await db
        .update(charmDatabase)
        .set({
          name: charmData.name || existing.name,
          brand: charmData.brand || existing.brand,
          collection: charmData.collection || existing.collection,
          type: charmData.type || existing.type,
          releaseDate: charmData.releaseDate ? new Date(charmData.releaseDate) : existing.releaseDate,
          catalogueSeason: charmData.catalogueSeason || existing.catalogueSeason,
          originalPrice: charmData.originalPrice || existing.originalPrice,
          currency: charmData.currency || existing.currency,
          region: charmData.region || existing.region,
          materials: charmData.materials || existing.materials,
          colors: charmData.colors || existing.colors,
          description: charmData.description || existing.description,
          isLimited: charmData.isLimited ?? existing.isLimited,
          isCountryExclusive: charmData.isCountryExclusive ?? existing.isCountryExclusive,
          exclusiveCountry: charmData.exclusiveCountry || existing.exclusiveCountry,
          updatedAt: new Date(),
        })
        .where(eq(charmDatabase.styleId, contribution.styleId))
    } else {
      await db
        .insert(charmDatabase)
        .values({
          styleId: contribution.styleId,
          name: charmData.name || 'Unknown',
          brand: charmData.brand || 'Pandora',
          collection: charmData.collection || null,
          type: charmData.type || 'charm',
          releaseDate: charmData.releaseDate ? new Date(charmData.releaseDate) : null,
          catalogueSeason: charmData.catalogueSeason || null,
          originalPrice: charmData.originalPrice || null,
          currency: charmData.currency || 'USD',
          region: charmData.region || null,
          materials: charmData.materials || null,
          colors: charmData.colors || null,
          description: charmData.description || null,
          isLimited: charmData.isLimited || false,
          isCountryExclusive: charmData.isCountryExclusive || false,
          exclusiveCountry: charmData.exclusiveCountry || null,
          createdBy: contribution.contributedBy,
          verified: true,
          verifiedBy: auth.id,
        })
    }

    if (contribution.imageUrl) {
      await db
        .insert(charmImages)
        .values({
          styleId: contribution.styleId,
          url: contribution.imageUrl,
          imageType: 'community',
          uploadedBy: contribution.contributedBy,
          approved: true,
          approvedBy: auth.id,
        })
    }
  }

  await db
    .update(charmContributions)
    .set({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: auth.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    })
    .where(eq(charmContributions.id, contributionId))

  return {
    success: true,
    action,
  }
})
