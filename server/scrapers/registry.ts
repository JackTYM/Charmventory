import type { ScraperModule, ScraperResult, ScraperConfig } from './types'
import { flipsnackModule } from './modules/flipsnack'
import { pandoraNetModule } from './modules/pandora-net'
import { artOfPandoraModule } from './modules/art-of-pandora'
import { denmarkStyleModule } from './modules/denmarkstyle'
import { authorizedResellersModule } from './modules/authorized-resellers'
import { waybackModule } from './modules/wayback'
import { hannoushModule } from './modules/hannoush'
import { elisaIlanaModule } from './modules/elisa-ilana'
import { boolchandsModule } from './modules/boolchands'
import { benbridgeArchiveModule } from './modules/benbridge-archive'
import { albertsModule } from './modules/alberts'

// Registry of all available scrapers
const scraperModules: Record<string, ScraperModule> = {
  flipsnack: flipsnackModule,
  'pandora-net': pandoraNetModule,
  'art-of-pandora': artOfPandoraModule,
  denmarkstyle: denmarkStyleModule,
  'authorized-resellers': authorizedResellersModule,
  wayback: waybackModule,
  hannoush: hannoushModule,
  'elisa-ilana': elisaIlanaModule,
  boolchands: boolchandsModule,
  'benbridge-archive': benbridgeArchiveModule,
  alberts: albertsModule,
}

// In-memory config storage (could be moved to database)
const scraperConfigs: Record<string, ScraperConfig> = {}

// Running scrapers
const runningScrapers: Set<string> = new Set()

export function getAvailableScrapers(): Array<{
  name: string
  description: string
  config: ScraperConfig
  isRunning: boolean
}> {
  return Object.entries(scraperModules).map(([name, module]) => ({
    name,
    description: module.description,
    config: scraperConfigs[name] || module.defaultConfig,
    isRunning: runningScrapers.has(name),
  }))
}

export function getScraperConfig(name: string): ScraperConfig | null {
  if (!scraperModules[name]) return null
  return scraperConfigs[name] || scraperModules[name].defaultConfig
}

export function updateScraperConfig(name: string, config: Partial<ScraperConfig>): ScraperConfig | null {
  if (!scraperModules[name]) return null

  scraperConfigs[name] = {
    ...(scraperConfigs[name] || scraperModules[name].defaultConfig),
    ...config,
  }

  return scraperConfigs[name]
}

export async function runScraper(name: string): Promise<ScraperResult> {
  const module = scraperModules[name]
  if (!module) {
    throw new Error(`Unknown scraper: ${name}`)
  }

  if (runningScrapers.has(name)) {
    throw new Error(`Scraper ${name} is already running`)
  }

  const config = scraperConfigs[name] || module.defaultConfig
  if (!config.enabled) {
    throw new Error(`Scraper ${name} is disabled`)
  }

  runningScrapers.add(name)

  try {
    const scraper = module.create()
    const result = await scraper.run()

    // Update config with last run info
    scraperConfigs[name] = {
      ...config,
      lastRun: result.startedAt,
      lastResult: result,
    }

    return result
  } finally {
    runningScrapers.delete(name)
  }
}

export function isScraperRunning(name: string): boolean {
  return runningScrapers.has(name)
}

export function getScraperModules(): Record<string, ScraperModule> {
  return scraperModules
}

// Get all scraper results
export function getScraperResults(): Record<string, ScraperResult | undefined> {
  const results: Record<string, ScraperResult | undefined> = {}

  for (const name of Object.keys(scraperModules)) {
    const config = scraperConfigs[name]
    results[name] = config?.lastResult
  }

  return results
}
