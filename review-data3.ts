import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Check murano items
  console.log('--- MURANO ITEMS SAMPLE ---\n');
  const muranoSample = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'murano'
    LIMIT 15
  `);
  console.table(muranoSample.rows);

  // Check safety chains
  console.log('\n--- SAFETY CHAIN ITEMS ---\n');
  const safetySample = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'safety_chain'
    LIMIT 15
  `);
  console.table(safetySample.rows);

  // Check items typed as "other"
  console.log('\n--- ITEMS TYPED AS "OTHER" ---\n');
  const otherItems = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'other'
  `);
  console.table(otherItems.rows);

  // Check pendants
  console.log('\n--- PENDANT ITEMS SAMPLE ---\n');
  const pendantSample = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'pendant'
    LIMIT 15
  `);
  console.table(pendantSample.rows);

  // Check for HTML entities in names
  console.log('\n--- NAMES WITH HTML ENTITIES ---\n');
  const htmlEntities = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE name ~ '&[a-z]+;'
    LIMIT 20
  `);
  console.table(htmlEntities.rows);

  // Check bangle items
  console.log('\n--- BANGLE ITEMS SAMPLE ---\n');
  const bangleSample = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'bangle'
    LIMIT 15
  `);
  console.table(bangleSample.rows);

  process.exit(0);
}
main();
