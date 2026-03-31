import { db } from '../../db'
import { charmContributions, charmDatabase } from '../../db/schema'
import { getUserFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const auth = await getUserFromRequest(event)

  const {
    styleId,
    name,
    brand,
    collection,
    type,
    releaseDate,
    catalogueSeason,
    originalPrice,
    currency,
    region,
    materials,
    colors,
    description,
    isLimited,
    isCountryExclusive,
    exclusiveCountry,
    imageUrl,
    notes,
  } = body

  if (!styleId || !name) {
    throw createError({
      statusCode: 400,
      message: 'Style ID and name are required',
    })
  }

  // Check if charm already exists in database
  const existingCharm = await db
    .select()
    .from(charmDatabase)
    .where(eq(charmDatabase.styleId, styleId))
    .limit(1)

  // Build charm data object for the contribution
  const charmData = {
    name,
    brand: brand || 'Pandora',
    collection: collection || null,
    type: type || 'charm',
    releaseDate: releaseDate || null,
    catalogueSeason: catalogueSeason || null,
    originalPrice: originalPrice || null,
    currency: currency || 'USD',
    region: region || null,
    materials: materials ? JSON.stringify(materials) : null,
    colors: colors ? JSON.stringify(colors) : null,
    description: description || null,
    isLimited: isLimited || false,
    isCountryExclusive: isCountryExclusive || false,
    exclusiveCountry: exclusiveCountry || null,
  }

  // Create contribution record
  const contribution = await db
    .insert(charmContributions)
    .values({
      styleId,
      contributionType: existingCharm.length > 0 ? 'edit_charm' : 'new_charm',
      newValue: JSON.stringify(charmData),
      imageUrl: imageUrl || null,
      notes: notes || null,
      contributedBy: auth?.id || 'anonymous',
      status: 'pending',
    })
    .returning()

  return {
    success: true,
    contribution: contribution[0],
    isNewCharm: existingCharm.length === 0,
  }
})
