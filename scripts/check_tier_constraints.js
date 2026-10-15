const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  try {
    const tierTables = [
      'edc_referral_tier_harga',
      'simcard_tier_harga',
      'router_tier_harga',
      'cloudsim_tier_harga',
      'logistik_tier_harga'
    ];

    for (const tbl of tierTables) {
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
