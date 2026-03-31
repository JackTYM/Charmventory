// Scraper types and interfaces

export interface ScrapedCharm {
  styleId: string
  name: string
  brand?: string
  collection?: string
  type?: string
  releaseDate?: Date
  discontinueDate?: Date
  catalogueSeason?: string
  originalPrice?: number
  currency?: string
  region?: string
  materials?: string[]
  colors?: string[]
  description?: string
  isLimited?: boolean
  isCountryExclusive?: boolean
  exclusiveCountry?: string
  isRetired?: boolean
  imageUrls?: string[]
}

export interface CharmSighting {
  styleId: string
  catalogId?: string
  catalogName?: string
  year?: number
  season?: string
  region?: string
  pageNumber?: number
  extractedName?: string
  extractedPrice?: number
  extractedCurrency?: string
  extractedDescription?: string
  imageUrl?: string
  sourceUrl: string
}

export interface ScrapedCatalog {
  name: string
  year: number
  season: string
  region: string
  pdfUrl?: string
  pageUrls?: string[]
  sourceUrl: string
}

export interface ScraperResult {
  success: boolean
  scraper: string
  startedAt: Date
  completedAt: Date
  charmsFound: number
  charmsAdded: number
  charmsUpdated: number
  catalogsFound: number
  sightingsAdded: number
  errors: string[]
}

export interface ScraperConfig {
  enabled: boolean
  cronSchedule?: string // e.g., "0 0 * * *" for daily at midnight
  rateLimit?: number // requests per second
  lastRun?: Date
  lastResult?: ScraperResult
}

export interface Scraper {
  name: string
  description: string
  config: ScraperConfig

  // Main scrape method
  run(): Promise<ScraperResult>

  // Optional: test connection/auth
  test?(): Promise<boolean>
}

export interface ScraperModule {
  name: string
  description: string
  defaultConfig: ScraperConfig
  create: () => Scraper
}
