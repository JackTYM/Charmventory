import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('pandora.json', 'utf-8'));

// Filter and extract just the URLs
const links = data.slice(1)
  .filter(row => row[0].includes('guide'))
  .map(row => row[0]);

writeFileSync('pandora_filtered.txt', links.join('\n'));

console.log(`Extracted ${links.length} links containing "catalog"`);
