#!/usr/bin/env npx tsx
/**
 * Run a scraper from the command line
 * Usage: npm run scrape <scraper-name>
 * Example: npm run scrape pandora-net
 */

// Load environment variables from .env BEFORE any other imports
import { config } from 'dotenv'
config()

async function main() {
  // Dynamic import after env vars are loaded
  const { getScraperModules } = await import('../server/scrapers/registry')
  const scraperName = process.argv[2]

  if (!scraperName) {
    console.log('Available scrapers:')
    const modules = getScraperModules()
    for (const [name, mod] of Object.entries(modules)) {
      console.log(`  - ${name}: ${mod.description}`)
    }
    console.log('\nUsage: npm run scrape <scraper-name>')
    console.log('       npm run scrape all')
    process.exit(1)
  }

  const modules = getScraperModules()

  if (scraperName === 'all') {
    console.log('Running all scrapers...\n')
    for (const [name, mod] of Object.entries(modules)) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Starting: ${name}`)
      console.log('='.repeat(60))
      const scraper = mod.create()
      const result = await scraper.run()
      console.log(`\nResult: ${result.success ? 'SUCCESS' : 'FAILED'}`)
      console.log(`  Charms found: ${result.charmsFound}`)
      console.log(`  Charms added: ${result.charmsAdded}`)
      console.log(`  Sightings added: ${result.sightingsAdded}`)
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.slice(0, 5).join(', ')}`)
      }
    }
  } else {
    const mod = modules[scraperName]
    if (!mod) {
      console.error(`Unknown scraper: ${scraperName}`)
      console.log('Available scrapers:', Object.keys(modules).join(', '))
      process.exit(1)
    }

    console.log(`Running ${scraperName}...`)
    console.log(`Description: ${mod.description}\n`)

    const scraper = mod.create()
    const result = await scraper.run()

    console.log(`\nResult: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`  Duration: ${((result.completedAt.getTime() - result.startedAt.getTime()) / 1000 / 60).toFixed(1)} minutes`)
    console.log(`  Charms found: ${result.charmsFound}`)
    console.log(`  Charms added: ${result.charmsAdded}`)
    console.log(`  Charms updated: ${result.charmsUpdated}`)
    console.log(`  Sightings added: ${result.sightingsAdded}`)
    if (result.errors.length > 0) {
      console.log(`  Errors (${result.errors.length}):`)
      result.errors.slice(0, 10).forEach(e => console.log(`    - ${e}`))
    }
  }
}

main().catch(console.error)
