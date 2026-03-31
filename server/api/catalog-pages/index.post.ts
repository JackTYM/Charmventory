import { db } from '../../db'
import { catalogPages, users } from '../../db/schema'
import { getUserFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const auth = await getUserFromRequest(event)
  const body = await readBody(event)

  const { catalogName, year, season, region, pageNumber, imageUrl, pages } = body

  // Handle bulk upload (array of pages)
  if (pages && Array.isArray(pages)) {
    if (!catalogName || !year || !season) {
      throw createError({
        statusCode: 400,
        message: 'Catalog name, year, and season required',
      })
    }

    // Ensure user exists if authenticated
    if (auth?.id) {
      const [existingUser] = await db.select().from(users).where(eq(users.id, auth.id)).limit(1)
      if (!existingUser) {
        await db.insert(users).values({
          id: auth.id,
          email: auth.email || '',
          name: auth.name || '',
        }).onConflictDoNothing()
      }
    }

    const insertedPages = []
    for (const page of pages) {
      if (!page.imageUrl) continue

      const [inserted] = await db.insert(catalogPages).values({
        catalogName,
        year: Number(year),
        season,
        region: region || null,
        pageNumber: page.pageNumber ? Number(page.pageNumber) : null,
        imageUrl: page.imageUrl,
        ocrText: page.ocrText || null,
        uploadedBy: auth?.id || null,
        approved: false,
      }).returning()

      insertedPages.push(inserted)
    }

    return {
      message: `Successfully submitted ${insertedPages.length} page(s) for review`,
      pages: insertedPages,
    }
  }

  // Handle single page upload (legacy)
  if (!catalogName || !year || !imageUrl) {
    throw createError({
      statusCode: 400,
      message: 'Catalog name, year, and image URL required',
    })
  }

  if (auth?.id) {
    const [existingUser] = await db.select().from(users).where(eq(users.id, auth.id)).limit(1)
    if (!existingUser) {
      await db.insert(users).values({
        id: auth.id,
        email: auth.email || '',
        name: auth.name || '',
      }).onConflictDoNothing()
    }
  }

  const [page] = await db.insert(catalogPages).values({
    catalogName,
    year: Number(year),
    season,
    region,
    pageNumber: pageNumber ? Number(pageNumber) : null,
    imageUrl,
    uploadedBy: auth?.id || null,
    approved: false,
  }).returning()

  return page
})
