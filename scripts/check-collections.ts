import { config } from 'dotenv';
config();

async function main() {
  const { db } = await import('../server/db');
  const { charmDatabase } = await import('../server/db/schema');
  const { sql } = await import('drizzle-orm');

  // Check unique collections
  const collections = await db.execute(sql`
    SELECT collection, COUNT(*) as count 
    FROM charm_database 
    WHERE collection IS NOT NULL 
    GROUP BY collection 
    ORDER BY count DESC
    LIMIT 20
  `);
  console.log('Collections:', JSON.stringify(collections.rows, null, 2));

  // Check unique types
  const types = await db.execute(sql`
    SELECT type, COUNT(*) as count 
    FROM charm_database 
    GROUP BY type 
    ORDER BY count DESC
  `);
  console.log('Types:', JSON.stringify(types.rows, null, 2));
}

main().then(() => process.exit(0));
