import { config } from 'dotenv';
config();

async function main() {
  const { db } = await import('../server/db');
  const { charmDatabase } = await import('../server/db/schema');
  const { sql } = await import('drizzle-orm');

  // Fix 58XXXX: should be bracelet, not earring
  await db.execute(sql`
    UPDATE charm_database 
    SET type = 'bracelet' 
    WHERE style_id LIKE '58%' AND type = 'earring'
  `);
  console.log('Fixed 58XXXX types to bracelet');

  // Fix 59XXXX: should be bracelet
  await db.execute(sql`
    UPDATE charm_database 
    SET type = 'bracelet' 
    WHERE style_id LIKE '59%' AND type != 'bracelet'
  `);
  console.log('Fixed 59XXXX types to bracelet');

  // Fix 29/28/26XXXX: should be earring
  await db.execute(sql`
    UPDATE charm_database 
    SET type = 'earring' 
    WHERE (style_id LIKE '29%' OR style_id LIKE '28%' OR style_id LIKE '26%') 
    AND type != 'earring'
  `);
  console.log('Fixed earring types');

  // Fix 39/38XXXX: should be necklace
  await db.execute(sql`
    UPDATE charm_database 
    SET type = 'necklace' 
    WHERE (style_id LIKE '39%' OR style_id LIKE '38%') 
    AND type != 'necklace'
  `);
  console.log('Fixed necklace types');

  // Verify
  const types = await db.execute(sql`
    SELECT type, COUNT(*) as count 
    FROM charm_database 
    GROUP BY type 
    ORDER BY count DESC
  `);
  console.log('Updated types:', JSON.stringify(types.rows, null, 2));
}

main().then(() => process.exit(0));
