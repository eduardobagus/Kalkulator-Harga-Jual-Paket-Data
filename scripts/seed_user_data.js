const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

const userProducts = [
  // MONTHLY CHARGE - IOT/M2M
  { kategori: 'IOT_M2M', penyedia: 'DPT', status_stok: 'CLOSED', provider: 'Telkomsel', nama_paket: 'Telkomsel 0.5 GB', kuota_gb: 0.5, cogs: 55500 },
  { kategori: 'IOT_M2M', penyedia: 'DPT', status_stok: 'CLOSED', provider: 'Telkomsel', nama_paket: 'Telkomsel 1 GB', kuota_gb: 1, cogs: 15000 },
  { kategori: 'IOT_M2M', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel Individual Sharing', nama_paket: 'Telkomsel Individual Sharing 2 GB', kuota_gb: 2, cogs: 36000 },
  { kategori: 'IOT_M2M', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel Individual Sharing', nama_paket: 'Telkomsel Individual Sharing 5 GB', kuota_gb: 5, cogs: 75000 },
  { kategori: 'IOT_M2M', penyedia: 'DPT', status_stok: 'OPEN', provider: 'Telkomsel Individual Package', nama_paket: 'Telkomsel Individual Package 3 GB', kuota_gb: 3, cogs: 32500 },

  // MONTHLY CHARGE - POSTPAID
  { kategori: 'POSTPAID', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel', nama_paket: 'Telkomsel 0.5 GB', kuota_gb: 0.5, cogs: 22700 },
  { kategori: 'POSTPAID', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel', nama_paket: 'Telkomsel 1 GB', kuota_gb: 1, cogs: 27750 },
  { kategori: 'POSTPAID', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel', nama_paket: 'Telkomsel 3 GB', kuota_gb: 3, cogs: 35000 },
  { kategori: 'POSTPAID', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel', nama_paket: 'Telkomsel 12 GB', kuota_gb: 12, cogs: 50000 },
  { kategori: 'POSTPAID', penyedia: 'RTS', status_stok: 'OPEN', provider: 'Telkomsel', nama_paket: 'Telkomsel 16 GB', kuota_gb: 16, cogs: 65000 },

  // PAYU TSEL
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 0.25 GB', nama_paket: 'PAYU+ M2M 0.25 GB', kuota_gb: 0.25, cogs: 9000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 0.5 GB', nama_paket: 'PAYU+ M2M 0.5 GB', kuota_gb: 0.5, cogs: 12000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 1 GB', nama_paket: 'PAYU+ M2M 1 GB', kuota_gb: 1, cogs: 16000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 2 GB', nama_paket: 'PAYU+ M2M 2 GB', kuota_gb: 2, cogs: 20000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 3 GB', nama_paket: 'PAYU+ M2M 3 GB', kuota_gb: 3, cogs: 30000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 0.5 GB (3 Days)', nama_paket: '0.5 GB (3 Days)', kuota_gb: 0.5, cogs: 6000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 1 GB (1 Day)', nama_paket: '1 GB (1 Day)', kuota_gb: 1, cogs: 7000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 1 GB (3 Days)', nama_paket: '1 GB (3 Days)', kuota_gb: 1, cogs: 10000 },
  { kategori: 'PAYU', penyedia: 'SASMITA', status_stok: 'CLOSED', provider: 'PAYU+ M2M 2 GB (3 Days)', nama_paket: '2 GB (3 Days)', kuota_gb: 2, cogs: 12000 }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT COUNT(*) FROM simcard_produk');
    if (parseInt(check.rows[0].count, 10) === 0) {
      console.log('Seeding user products into simcard_produk...');
      const margins = [30, 25, 20, 15, 10];
      const quantities = [100, 150, 200, 300, 500];

      for (const p of userProducts) {
        const ins = await client.query(`
          INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [p.kategori, p.penyedia, p.status_stok, p.provider, p.nama_paket, p.kuota_gb, p.cogs]);

        const prodId = ins.rows[0].id;
        for (let t = 1; t <= 5; t++) {
          await client.query(`
            INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (produk_id, tier_ke) DO NOTHING
          `, [prodId, t, quantities[t - 1], margins[t - 1]]);
        }
      }
      await client.query('COMMIT');
      console.log('Seeded', userProducts.length, 'products successfully!');
    } else {
      console.log('simcard_produk already has', check.rows[0].count, 'products.');
      await client.query('ROLLBACK');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
