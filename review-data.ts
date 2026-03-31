import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== DATA QUALITY REVIEW ===\n');

  // 1. Check type vs name mismatches
  console.log('--- POTENTIAL TYPE MISMATCHES ---\n');
  
  // Rings not typed as ring
  const ringMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE name ~* '\bring\b' AND type != 'ring'
    LIMIT 10
  `);
  console.log('Items with "ring" in name but not typed as ring:');
  console.table(ringMismatches.rows);

  // Earrings not typed correctly
  const earringMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE (name ~* '\bearring' OR name ~* '\bstud\b' OR name ~* '\bhoop\b' OR name ~* 'oreilles')
    AND type != 'earring'
    LIMIT 10
  `);
  console.log('\nItems with earring keywords but not typed as earring:');
  console.table(earringMismatches.rows);

  // Necklaces not typed correctly
  const necklaceMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE (name ~* '\bnecklace\b' OR name ~* '\bchain\b' OR name ~* '\bcollier\b')
    AND type NOT IN ('necklace', 'safety_chain')
    LIMIT 10
  `);
  console.log('\nItems with necklace keywords but not typed as necklace:');
  console.table(necklaceMismatches.rows);

  // Bracelets not typed correctly
  const braceletMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE name ~* '\bbracelet\b' AND type NOT IN ('bracelet', 'bangle')
    LIMIT 10
  `);
  console.log('\nItems with "bracelet" in name but not typed as bracelet:');
  console.table(braceletMismatches.rows);

  // Clips not typed correctly  
  const clipMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE name ~* '\bclip\b' AND type != 'clip'
    LIMIT 10
  `);
  console.log('\nItems with "clip" in name but not typed as clip:');
  console.table(clipMismatches.rows);

  // Spacers not typed correctly
  const spacerMismatches = await db.execute(sql`
    SELECT style_id, name, type FROM charm_database 
    WHERE name ~* '\bspacer\b' AND type != 'spacer'
    LIMIT 10
  `);
  console.log('\nItems with "spacer" in name but not typed as spacer:');
  console.table(spacerMismatches.rows);

  process.exit(0);
}
main();
