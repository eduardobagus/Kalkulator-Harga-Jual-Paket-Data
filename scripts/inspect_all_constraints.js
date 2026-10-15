const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  const tables = ['simcard_produk', 'edc_referral_produk', 'router_produk', 'cloudsim_produk', 'logistik_produk'];
  for (const t of tables) {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c 
      JOIN pg_class cl ON c.conrelid = cl.oid 
      WHERE cl.relname = $1 AND c.contype = 'c'
    `, [t]);
    console.log(t, res.rows);
  }
  await pool.end();
}

main().catch(console.error);
