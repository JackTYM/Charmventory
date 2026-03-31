import type { Scraper, ScraperConfig, ScraperResult, ScrapedCharm, CharmSighting } from './types'
import { db } from '../db'
import { charmDatabase, charmImages, charmSightings } from '../db/schema'
import { eq, sql, inArray } from 'drizzle-orm'
import puppeteer from 'puppeteer-core'
import type { Browser, Page } from 'puppeteer-core'

export abstract class BaseScraper implements Scraper {
  abstract name: string
  abstract description: string
  config: ScraperConfig

  protected errors: string[] = []
  protected charmsFound = 0
  protected charmsAdded = 0
  protected charmsUpdated = 0
  protected catalogsFound = 0
  protected sightingsAdded = 0

  // Browser instance for Cloudflare bypass
  protected browser: Browser | null = null
  protected browserPage: Page | null = null

  // Batch queues for faster inserts
  private pendingCharms: Map<string, ScrapedCharm> = new Map()
  private pendingImages: Array<{ styleId: string; url: string }> = []
  private pendingSightings: CharmSighting[] = []
  private processedStyleIds: Set<string> = new Set()
  private readonly BATCH_SIZE = 100

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      enabled: true,
      rateLimit: 1, // 1 request per second default
      ...config,
    }
  }

  // Abstract method that subclasses must implement
  protected abstract scrape(): Promise<void>

  async run(): Promise<ScraperResult> {
    const startedAt = new Date()
    this.errors = []
    this.charmsFound = 0
    this.charmsAdded = 0
    this.charmsUpdated = 0
    this.catalogsFound = 0
    this.sightingsAdded = 0
    this.pendingCharms.clear()
    this.pendingImages = []
    this.pendingSightings = []
    this.processedStyleIds.clear()

    let success = true

    try {
      await this.scrape()
      // Flush any remaining batched items
      await this.flushAll()
      // Mark all processed products as ready
      await this.markProductsComplete()
    } catch (e: any) {
      success = false
      this.errors.push(e.message || 'Unknown error')
    } finally {
      await this.closeBrowser()
    }

    const result: ScraperResult = {
      success,
      scraper: this.name,
      startedAt,
      completedAt: new Date(),
      charmsFound: this.charmsFound,
      charmsAdded: this.charmsAdded,
      charmsUpdated: this.charmsUpdated,
      catalogsFound: this.catalogsFound,
      sightingsAdded: this.sightingsAdded,
      errors: this.errors,
    }

    this.config.lastRun = startedAt
    this.config.lastResult = result

    return result
  }

  // Helper: Rate-limited fetch
  protected async fetchWithRateLimit(url: string, options?: RequestInit): Promise<Response> {
    if (this.config.rateLimit) {
      await this.delay(1000 / this.config.rateLimit)
    }
    return fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Charmventory Database Bot (https://charmventory.com)',
        ...options?.headers,
      },
    })
  }

  // Helper: Delay
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Helper: Launch headless browser for Cloudflare bypass
  protected async launchBrowser(): Promise<void> {
    if (this.browser) return

    this.log('Launching headless browser...')
    this.browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    })
    this.browserPage = await this.browser.newPage()

    // Set user agent to look like a real browser
    await this.browserPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
  }

  // Helper: Close browser
  protected async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.browserPage = null
    }
  }

  // Helper: Fetch with browser (bypasses Cloudflare)
  protected async fetchWithBrowser(url: string): Promise<string> {
    if (!this.browserPage) {
      await this.launchBrowser()
    }

    if (this.config.rateLimit) {
      await this.delay(1000 / this.config.rateLimit)
    }

    this.log(`Browser fetching: ${url}`)
    await this.browserPage!.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Wait for any Cloudflare challenge to resolve
    await this.delay(2000)

    return await this.browserPage!.content()
  }

  // Queue charm for batch insert
  protected async saveCharm(charm: ScrapedCharm): Promise<'added' | 'updated' | 'unchanged'> {
    this.charmsFound++

    // Queue the charm (deduped by styleId)
    const existing = this.pendingCharms.get(charm.styleId.toUpperCase())
    if (!existing) {
      this.pendingCharms.set(charm.styleId.toUpperCase(), charm)
    }

    // Queue images
    if (charm.imageUrls?.length) {
      for (const url of charm.imageUrls) {
        this.pendingImages.push({ styleId: charm.styleId.toUpperCase(), url })
      }
    }

    // Flush charms if batch is full (images flush at end only to ensure FK constraints)
    if (this.pendingCharms.size >= this.BATCH_SIZE) {
      await this.flushCharms()
    }

    return 'added'
  }

  // Queue sighting for batch insert
  protected async saveSighting(sighting: CharmSighting): Promise<boolean> {
    this.pendingSightings.push(sighting)

    // Flush if batch is full
    if (this.pendingSightings.length >= this.BATCH_SIZE) {
      await this.flushSightings()
    }

    return true
  }

  // Flush all pending items
  private async flushAll(): Promise<void> {
    await this.flushCharms()
    await this.flushImages()
    await this.flushSightings()
  }

  // Batch insert charms with ON CONFLICT
  private async flushCharms(): Promise<void> {
    if (this.pendingCharms.size === 0) return

    const charms = Array.from(this.pendingCharms.values())
    this.pendingCharms.clear()

    // Insert in smaller chunks to avoid query size limits
    const CHUNK_SIZE = 25
    for (let i = 0; i < charms.length; i += CHUNK_SIZE) {
      const chunk = charms.slice(i, i + CHUNK_SIZE)

      try {
        const values = chunk.map(charm => ({
          styleId: charm.styleId.toUpperCase(),
          name: charm.name || '',
          brand: charm.brand || 'Pandora',
          collection: charm.collection || null,
          type: (charm.type as any) || 'charm',
          releaseDate: charm.releaseDate || null,
          discontinueDate: charm.discontinueDate || null,
          catalogueSeason: charm.catalogueSeason || null,
          originalPrice: charm.originalPrice?.toString() || null,
          currency: charm.currency || 'USD',
          region: charm.region || null,
          materials: charm.materials ? JSON.stringify(charm.materials) : null,
          colors: charm.colors ? JSON.stringify(charm.colors) : null,
          description: charm.description || null,
          isLimited: charm.isLimited || false,
          isCountryExclusive: charm.isCountryExclusive || false,
          exclusiveCountry: charm.exclusiveCountry || null,
          isRetired: charm.isRetired || false,
          processing: true, // Mark as processing until scrape completes
          createdBy: `scraper:${this.name}`,
          verified: false,
        }))

        await db.insert(charmDatabase).values(values).onConflictDoNothing()

        // Track styleIds for marking complete later
        for (const charm of chunk) {
          this.processedStyleIds.add(charm.styleId.toUpperCase())
        }
        this.charmsAdded += chunk.length
      } catch (e: any) {
        this.logError(`Batch charm insert failed (chunk ${i / CHUNK_SIZE + 1}): ${e.message}`)
      }
    }
  }

  // Batch insert images with ON CONFLICT
  private async flushImages(): Promise<void> {
    if (this.pendingImages.length === 0) return

    const images = this.pendingImages
    this.pendingImages = []

    // Dedupe by styleId+url
    const unique = new Map<string, { styleId: string; url: string }>()
    for (const img of images) {
      const key = `${img.styleId}:${img.url}`
      if (!unique.has(key)) {
        unique.set(key, img)
      }
    }

    const allImages = Array.from(unique.values())

    // Insert in smaller chunks to avoid query size limits
    const CHUNK_SIZE = 25
    for (let i = 0; i < allImages.length; i += CHUNK_SIZE) {
      const chunk = allImages.slice(i, i + CHUNK_SIZE)

      try {
        const values = chunk.map(img => ({
          styleId: img.styleId,
          url: img.url,
          imageType: 'official' as const,
          uploadedBy: `scraper:${this.name}`,
          approved: true,
        }))

        await db.insert(charmImages).values(values).onConflictDoNothing()
      } catch (e: any) {
        this.logError(`Batch image insert failed (chunk ${i / CHUNK_SIZE + 1}): ${e.message}`)
      }
    }
  }

  // Batch insert sightings
  private async flushSightings(): Promise<void> {
    if (this.pendingSightings.length === 0) return

    const sightings = this.pendingSightings
    this.pendingSightings = []

    // Insert in smaller chunks to avoid query size limits
    const CHUNK_SIZE = 25
    for (let i = 0; i < sightings.length; i += CHUNK_SIZE) {
      const chunk = sightings.slice(i, i + CHUNK_SIZE)

      try {
        const values = chunk.map(s => ({
          styleId: s.styleId.toUpperCase(),
          catalogId: s.catalogId || null,
          catalogName: s.catalogName,
          year: s.year,
          season: s.season || null,
          region: s.region || null,
          pageNumber: s.pageNumber || null,
          extractedName: s.extractedName || null,
          extractedPrice: s.extractedPrice?.toString() || null,
          extractedCurrency: s.extractedCurrency || 'USD',
          extractedDescription: s.extractedDescription || null,
          imageUrl: s.imageUrl || null,
          sourceUrl: s.sourceUrl || null,
          scrapedBy: this.name,
        }))

        await db.insert(charmSightings).values(values)
        this.sightingsAdded += chunk.length
      } catch (e: any) {
        this.logError(`Batch sighting insert failed (chunk ${i / CHUNK_SIZE + 1}): ${e.message}`)
      }
    }
  }

  // Mark products as complete only if they have images (metadata + images = done)
  private async markProductsComplete(): Promise<void> {
    if (this.processedStyleIds.size === 0) return

    const styleIds = Array.from(this.processedStyleIds)
    this.log(`Checking ${styleIds.length} products for completion...`)

    try {
      // Find which styleIds actually have images
      const batchSize = 500
      let markedCount = 0

      for (let i = 0; i < styleIds.length; i += batchSize) {
        const batch = styleIds.slice(i, i + batchSize)

        // Get styleIds that have at least one image
        const withImages = await db
          .selectDistinct({ styleId: charmImages.styleId })
          .from(charmImages)
          .where(inArray(charmImages.styleId, batch))

        const styleIdsWithImages = withImages.map(r => r.styleId)

        if (styleIdsWithImages.length > 0) {
          await db.update(charmDatabase)
            .set({ processing: false })
            .where(inArray(charmDatabase.styleId, styleIdsWithImages))
          markedCount += styleIdsWithImages.length
        }
      }

      this.log(`Marked ${markedCount} products as complete (have images)`)
    } catch (e: any) {
      this.logError(`Failed to mark products complete: ${e.message}`)
    }
  }

  // Helper: Log error
  protected logError(message: string) {
    console.error(`[${this.name}] ${message}`)
    this.errors.push(message)
  }

  // Helper: Log info
  protected log(message: string) {
    console.log(`[${this.name}] ${message}`)
  }
}
