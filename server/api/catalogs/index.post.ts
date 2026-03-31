import { db } from '../../db'
import { catalogs, catalogRevisions } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { year, season, region, pdfUrl, pageCount, hasOcr, ocrText, revisionNote } = body

  if (!year || !season || !pdfUrl) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: year, season, pdfUrl',
    })
  }

  const regionValue = region || 'US'

  // Check if catalog already exists for this year/season/region
  let [existingCatalog] = await db
    .select()
    .from(catalogs)
    .where(
      and(
        eq(catalogs.year, year),
        eq(catalogs.season, season),
        eq(catalogs.region, regionValue)
      )
    )

  // Create catalog if it doesn't exist
  if (!existingCatalog) {
    [existingCatalog] = await db
      .insert(catalogs)
      .values({
        year,
        season,
        region: regionValue,
      })
      .returning()
  }

  // Create a new revision (pending approval)
  const [revision] = await db
    .insert(catalogRevisions)
    .values({
      catalogId: existingCatalog.id,
      pdfUrl,
      pageCount: pageCount || 0,
      hasOcr: hasOcr || false,
      ocrText: ocrText || null,
      revisionNote: revisionNote || 'Initial upload',
      status: 'pending',
    })
    .returning()

  return {
    catalog: existingCatalog,
    revision,
  }
})
