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

async function checkOtherTables() {
  const targetTables = [
    'edc_referral_produk', 'edc_referral_tier_harga',
    'router_produk', 'router_tier_harga',
    'cloudsim_produk', 'cloudsim_tier_harga',
    'logistik_produk', 'logistik_tier_harga',
    'kalkulator_pengaturan'
  ];

  for (const t of targetTables) {
    console.log(`\n========================================`);
    console.log(`TABLE: ${t}`);
    console.log(`========================================`);
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [t]);
    cols.rows.forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default})`);
    });

    const constraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      WHERE cl.relname = $1
    `, [t]);
    if (constraints.rows.length) {
      console.log(`  Constraints:`);
      constraints.rows.forEach(c => console.log(`    [${c.contype}] ${c.conname}: ${c.def}`));
    }

    const countRes = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
    console.log(`  Row count: ${countRes.rows[0].count}`);
    if (parseInt(countRes.rows[0].count, 10) > 0) {
      const sample = await pool.query(`SELECT * FROM "${t}" LIMIT 2`);
      console.log(`  Sample:`, sample.rows);
    }
  }

  await pool.end();
}

checkOtherTables().catch(console.error);
