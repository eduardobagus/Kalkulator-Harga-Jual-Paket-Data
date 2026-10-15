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
      const colRes = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tbl]);

      console.log(`\n${tbl}:`, colRes.rows.map(c => c.column_name).join(', '));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
