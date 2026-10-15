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
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tbl]);

      const countRes = await pool.query(`SELECT COUNT(*) FROM ${tbl}`);
      const rowsRes = await pool.query(`SELECT * FROM ${tbl} LIMIT 2`);

      console.log(`\n================== ${tbl.toUpperCase()} (count: ${countRes.rows[0].count}) ==================`);
      console.log('Columns:', colRes.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
      console.log('Sample rows:', rowsRes.rows);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
