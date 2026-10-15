const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const match = content.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim();
}

const pool = new Pool({ connectionString: dbUrl });

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '001_safe_schema_expansion.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log(`Applying safe non-destructive migration from ${migrationFile}...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully with 0 errors!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed and rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
