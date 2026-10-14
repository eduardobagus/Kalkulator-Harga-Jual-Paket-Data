const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kalkulator@localhost:5432/kalkulator_harga_jual'
});

async function test() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs
    `, ['PREPAID', 'DPT', 'CLOSED', 'Telkomsel', 'Telkomsel', 0.5, 55500]);
    
    console.log('Inserted product:', res.rows[0]);
    const prodId = res.rows[0].id;

    const tierRes = await client.query(`
      INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
      VALUES ($1, 1, 100, 30), ($1, 2, 150, 25), ($1, 3, 200, 20), ($1, 4, 300, 15), ($1, 5, 500, 10)
      RETURNING *
    `, [prodId]);
    console.log('Inserted tiers:', tierRes.rows);

    await client.query('ROLLBACK');
    console.log('Transaction test successfully rolled back.');
  } catch (e) {
    console.error('Test error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
