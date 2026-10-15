const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  try {
    const productTables = [
      'edc_referral_produk',
      'simcard_produk',
      'router_produk',
      'cloudsim_produk',
      'logistik_produk'
    ];

    for (const tbl of productTables) {
      const conRes = await pool.query(`
        SELECT conname, pg_get_constraintdef(c.oid) as def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = $1
      `, [tbl]);

      console.log(`\nConstraints for ${tbl}:`);
      conRes.rows.forEach(r => console.log(`  - ${r.conname}: ${r.def}`));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
