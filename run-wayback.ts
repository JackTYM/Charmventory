import { waybackModule } from './server/scrapers/modules/wayback'

async function run() {
  const scraper = waybackModule.create()
  console.log('Running full wayback scraper...')
  const result = await scraper.run()
  console.log('Result:', JSON.stringify(result, null, 2))
}

run()
