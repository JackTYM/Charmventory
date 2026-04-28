import { db } from '../../db'
import { catalogs, catalogRevisions } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  // Get all catalogs with their current revision
  const allCatalogs = await db
    .select({
      id: catalogs.id,
      year: catalogs.year,
      season: catalogs.season,
      region: catalogs.region,
      currentRevisionId: catalogs.currentRevisionId,
    })
    .from(catalogs)

  // Fetch current revision details for catalogs that have one
  const catalogsWithRevisions = await Promise.all(
    allCatalogs.map(async (catalog) => {
      let revision = null
      if (catalog.currentRevisionId) {
        [revision] = await db
          .select()
          .from(catalogRevisions)
          .where(eq(catalogRevisions.id, catalog.currentRevisionId))
      }
      return { ...catalog, revision }
    })
  )

  // Build a map of region -> year -> season -> status
  const regions = ['US', 'UK', 'EU', 'AU', 'Asia', 'Other']
  const currentYear = new Date().getFullYear()
  const regularSeasons = ['Spring', 'Summer', 'Autumn', 'Winter']
  const specialSeasons = [
    "Valentine's Day", "Mother's Day", "Father's Day",
    'Easter', 'Halloween', 'Christmas', 'Holiday',
    'Pre-Spring', 'Pre-Autumn', 'Year-Round', 'Special Edition'
  ]
  const allSeasons = [...regularSeasons, ...specialSeasons]

  const result: Array<{
    year: number
    season: string
    region: string
    status: 'complete' | 'partial' | 'missing'
    pages: number
    hasOcr: boolean
    catalogId: string | null
    pdfUrl: string | null
  }> = []

  // Generate entries for each region/year/season combo
  for (const region of regions) {
    for (let year = currentYear; year >= 2000; year--) {
      for (const season of allSeasons) {
        // Find catalog for this region/year/season
        const catalog = catalogsWithRevisions.find(
          c => c.year === year && c.season === season && c.region === region
        )

        let status: 'complete' | 'partial' | 'missing' = 'missing'
        if (catalog?.revision) {
          // Has an approved revision - check if it has OCR
          if (catalog.revision.hasOcr) {
            status = 'complete'
          } else {
            status = 'partial'
          }
        }
        // If catalog exists but no approved revision, keep status as 'missing'

        result.push({
          year,
          season,
          region,
          status,
          pages: catalog?.revision?.pageCount || 0,
          hasOcr: catalog?.revision?.hasOcr || false,
          catalogId: catalog?.id || null,
          pdfUrl: catalog?.revision?.pdfUrl || null,
        })
      }
    }
  }

  return result
})
