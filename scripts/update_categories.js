const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  try {
    await pool.query("UPDATE simcard_produk SET kategori = 'IOT_M2M' WHERE id BETWEEN 286 AND 290");
    await pool.query("UPDATE simcard_produk SET kategori = 'POSTPAID' WHERE id BETWEEN 291 AND 295");
    await pool.query("UPDATE simcard_produk SET kategori = 'PAYU' WHERE id BETWEEN 296 AND 304");

    const res = await pool.query("SELECT kategori, COUNT(*) FROM simcard_produk GROUP BY kategori ORDER BY kategori");
    console.log("CATEGORY COUNTS IN DB:", res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
