import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // 2. Check collection assignments
  console.log('--- COLLECTION DISTRIBUTION ---\n');
  const collections = await db.execute(sql`
    SELECT collection, COUNT(*) as count FROM charm_database 
    GROUP BY collection ORDER BY count DESC
  `);
  console.table(collections.rows);

  // 3. Items with Disney/Marvel in name but wrong collection
  console.log('\n--- COLLECTION MISMATCHES ---\n');
  const disneyMismatch = await db.execute(sql`
    SELECT style_id, name, collection FROM charm_database 
    WHERE name ~* '\bdisney\b' AND (collection IS NULL OR collection != 'Disney')
    LIMIT 10
  `);
  console.log('Disney items without Disney collection:');
  console.table(disneyMismatch.rows);

  const marvelMismatch = await db.execute(sql`
    SELECT style_id, name, collection FROM charm_database 
    WHERE name ~* '\bmarvel\b' AND (collection IS NULL OR collection != 'Marvel')
    LIMIT 10
  `);
  console.log('\nMarvel items without Marvel collection:');
  console.table(marvelMismatch.rows);

  // 4. Check "charm" type items - sample to see if any look wrong
  console.log('\n--- SAMPLE OF CHARM-TYPED ITEMS ---\n');
  const charmSample = await db.execute(sql`
    SELECT style_id, name FROM charm_database 
    WHERE type = 'charm'
    ORDER BY RANDOM()
    LIMIT 30
  `);
  console.log('Random sample of items typed as "charm":');
  console.table(charmSample.rows);

  // 5. Check for potential dangles/charms typed as something else
  console.log('\n--- POTENTIAL CHARM MISCLASSIFICATIONS ---\n');
  const dangleMismatch = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE (name ~* '\bdangle\b' OR name ~* '\bcharm\b') 
    AND type NOT IN ('charm', 'clip', 'murano', 'spacer', 'safety_chain')
    LIMIT 15
  `);
  console.log('Items with "dangle" or "charm" in name but not charm-related type:');
  console.table(dangleMismatch.rows);

  process.exit(0);
}
main();
