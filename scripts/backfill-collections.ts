/**
 * Backfill collections for products based on their names
 */
import { db } from '../server/db'
import { charmDatabase } from '../server/db/schema'
import { isNull, eq } from 'drizzle-orm'

const collectionPatterns = [
  { pattern: /\bDisney\b/i, name: 'Disney' },
  { pattern: /\bMarvel\b/i, name: 'Marvel' },
  { pattern: /\bHarry Potter\b/i, name: 'Harry Potter' },
  { pattern: /\bGame of Thrones\b/i, name: 'Game of Thrones' },
  { pattern: /\bStar Wars\b/i, name: 'Star Wars' },
  { pattern: /\bPeanuts\b/i, name: 'Peanuts' },
  { pattern: /\bBridgerton\b/i, name: 'Bridgerton' },
  { pattern: /\bLooney Tunes\b/i, name: 'Looney Tunes' },
  { pattern: /\bSesame Street\b/i, name: 'Sesame Street' },
  { pattern: /\bThe Little Mermaid\b/i, name: 'Disney' },
  { pattern: /\bCinderella\b/i, name: 'Disney' },
  { pattern: /\bFrozen\b/i, name: 'Disney' },
  { pattern: /\bMickey\b/i, name: 'Disney' },
  { pattern: /\bMinnie\b/i, name: 'Disney' },
  { pattern: /\bWinnie the Pooh\b/i, name: 'Disney' },
  { pattern: /\bTinker\s?Bell\b/i, name: 'Disney' },
  { pattern: /\bSimba\b/i, name: 'Disney' },
  { pattern: /\bLion King\b/i, name: 'Disney' },
  { pattern: /\bAladdin\b/i, name: 'Disney' },
  { pattern: /\bJasmine\b/i, name: 'Disney' },
  { pattern: /\bBelle\b/i, name: 'Disney' },
  { pattern: /\bAriel\b/i, name: 'Disney' },
  { pattern: /\bMoana\b/i, name: 'Disney' },
  { pattern: /\bStitch\b/i, name: 'Disney' },
  { pattern: /\bPixar\b/i, name: 'Disney' },
  { pattern: /\bSpider-?Man\b/i, name: 'Marvel' },
  { pattern: /\bAvengers\b/i, name: 'Marvel' },
  { pattern: /\bIron Man\b/i, name: 'Marvel' },
  { pattern: /\bCaptain America\b/i, name: 'Marvel' },
  { pattern: /\bThor\b/i, name: 'Marvel' },
  { pattern: /\bHulk\b/i, name: 'Marvel' },
  { pattern: /\bBlack Panther\b/i, name: 'Marvel' },
  { pattern: /\bHogwarts\b/i, name: 'Harry Potter' },
  { pattern: /\bGryffindor\b/i, name: 'Harry Potter' },
  { pattern: /\bSlytherin\b/i, name: 'Harry Potter' },
  { pattern: /\bRavenclaw\b/i, name: 'Harry Potter' },
  { pattern: /\bHufflepuff\b/i, name: 'Harry Potter' },
  { pattern: /\bGolden Snitch\b/i, name: 'Harry Potter' },
  { pattern: /\bME\b/, name: 'Pandora ME' },
  { pattern: /\bMoments\b/i, name: 'Moments' },
  { pattern: /\bSignature\b/i, name: 'Signature' },
  { pattern: /\bTimeless\b/i, name: 'Timeless' },
  { pattern: /\bReflexions\b/i, name: 'Reflexions' },
  { pattern: /\bEssence\b/i, name: 'Essence' },
]

function extractCollection(name: string): string | null {
  for (const { pattern, name: collName } of collectionPatterns) {
    if (pattern.test(name)) {
      return collName
    }
  }
  return null
}

async function backfillCollections() {
  console.log('Fetching products without collections...')

  const products = await db.select({
    styleId: charmDatabase.styleId,
    name: charmDatabase.name,
  })
  .from(charmDatabase)
  .where(isNull(charmDatabase.collection))

  console.log(`Found ${products.length} products to check`)

  const collectionCounts: Record<string, number> = {}
  let updated = 0

  for (const product of products) {
    const collection = extractCollection(product.name || '')

    if (collection) {
      await db.update(charmDatabase)
        .set({ collection })
        .where(eq(charmDatabase.styleId, product.styleId))

      collectionCounts[collection] = (collectionCounts[collection] || 0) + 1
      updated++
    }
  }

  console.log(`\nUpdated ${updated} products with collections:`)
  console.log(collectionCounts)
}

backfillCollections().then(() => process.exit(0))
