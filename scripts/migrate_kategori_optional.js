const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  try {
    // 1. Drop the restrictive check constraint on simcard_produk
    await pool.query(`ALTER TABLE simcard_produk DROP CONSTRAINT IF EXISTS simcard_produk_kategori_check`);
    console.log('Successfully dropped simcard_produk_kategori_check');

    // 2. Make kategori nullable
    await pool.query(`ALTER TABLE simcard_produk ALTER COLUMN kategori DROP NOT NULL`);
    console.log('Successfully altered kategori to be nullable in simcard_produk');

    // 3. Also check other tables to ensure kategori is nullable
    const otherTables = ['edc_referral_produk', 'router_produk', 'cloudsim_produk', 'logistik_produk'];
    for (const t of otherTables) {
      try {
        await pool.query(`ALTER TABLE ${t} ALTER COLUMN kategori DROP NOT NULL`);
      } catch (e) {
        // already nullable or not exists
      }
    }
    console.log('All product tables now support optional & dynamic categories!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

main();
