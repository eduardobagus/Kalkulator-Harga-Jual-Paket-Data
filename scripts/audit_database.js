const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env.local without hardcoding credentials
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const match = content.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim();
}

const pool = new Pool({ connectionString: dbUrl });

async function audit() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("=== PUBLIC TABLES ===");
    console.log(tables.rows.map(r => r.table_name));

    for (const t of tables.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [t.table_name]);
      console.log(`\n========================================`);
      console.log(`TABLE: ${t.table_name} (${cols.rows.length} columns)`);
      console.log(`========================================`);
      console.table(cols.rows);

      const constraints = await pool.query(`
        SELECT conname, contype, pg_get_constraintdef(c.oid) as def
        FROM pg_constraint c
        JOIN pg_class cl ON c.conrelid = cl.oid
        WHERE cl.relname = $1
      `, [t.table_name]);
      if (constraints.rows.length) {
        console.log(`Constraints for ${t.table_name}:`);
        console.table(constraints.rows);
      }

      const countRes = await pool.query(`SELECT COUNT(*) FROM "${t.table_name}"`);
      console.log(`Row count:`, countRes.rows[0].count);

      if (parseInt(countRes.rows[0].count, 10) > 0) {
        const sampleRes = await pool.query(`SELECT * FROM "${t.table_name}" LIMIT 3`);
        console.log(`Sample rows (up to 3):`);
        console.log(sampleRes.rows);
      }
    }
  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await pool.end();
  }
}

audit();
