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

async function seedInitial() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed EDC Referral if empty
    const edcCount = await client.query('SELECT COUNT(*) FROM edc_referral_produk');
    if (parseInt(edcCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial EDC Referral data...');
      await client.query(`
        INSERT INTO edc_referral_produk (
          kategori, tipe_transaksi, spec_type, tier_min_qty, tier_max_qty, 
          selling_price, referral_fee_pct, referral_fee_per_unit, simulation_qty, total_referral_fee, remarks
        ) VALUES 
        (
          'EDC — One Time Charge', 'ONE_TIME', 'abc', 1, 200, 
          2875000, 5, 143750, 200, 28750000, 'EDC Sekali Bayar (Beli Putus)'
        ),
        (
          'EDC — Rent (Monthly Charge)', 'MONTHLY_RENT', '2/16/18', 1, 200, 
          250000, 5, 12500, 200, 2500000, 'EDC Sewa Bulanan'
        )
      `);
    }

    // 2. Seed Router if empty
    const routerCount = await client.query('SELECT COUNT(*) FROM router_produk');
    if (parseInt(routerCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial Router data (8 items)...');
      await client.query(`
        INSERT INTO router_produk (
          kategori, nama_produk, jenis_transaksi, jangka_waktu_sewa, 
          min_qty, max_qty, cogs_cku, cogs_rts, margin_pct, selling_price, gross_profit, remarks
        ) VALUES 
        ('Beli Putus', 'Router C9 Non-IP SEC', 'Beli Putus', NULL, 1, 9, 1600000, 1875000, 45, 3410000, 1535000, 'Router Standar Non IP SEC'),
        ('Sewa', 'Router C9 Non-IP SEC', 'Sewa', 12, 1, 9, 1600000, 287500, 45, 525000, 237500, 'Sewa 12 Bulan Router C9 Non IP SEC'),
        ('Beli Putus', 'Router C9 IP SEC', 'Beli Putus', NULL, 1, 9, 2300000, 2500000, 45, 4550000, 2050000, 'Router IP SEC Keamanan Tinggi'),
        ('Sewa', 'Router C9 IP SEC', 'Sewa', 12, 1, 9, 2300000, 383333, 45, 700000, 316667, 'Sewa 12 Bulan Router C9 IP SEC'),
        ('Aksesoris', 'Antena WiFi Router Dual Band', 'Aksesoris', NULL, 1, 9, NULL, NULL, 45, NULL, NULL, 'Aksesoris Antena Dual Band'),
        ('Aksesoris', 'Antena Magnet 4G LTE SMA Male 10 dBi', 'Aksesoris', NULL, 1, 9, NULL, NULL, 45, NULL, NULL, 'Aksesoris Antena Magnet'),
        ('Aksesoris', 'Adaptor Modem', 'Aksesoris', NULL, 1, 9, NULL, NULL, 45, NULL, NULL, 'Aksesoris Adaptor Power'),
        ('Beli Putus', 'Router Dongle D200', 'Beli Putus', NULL, 1, 9, NULL, NULL, 45, NULL, NULL, 'Perangkat USB Dongle D200')
      `);
    }

    // 3. Seed Cloudsim if empty
    const cloudsimCount = await client.query('SELECT COUNT(*) FROM cloudsim_produk');
    if (parseInt(cloudsimCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial Cloudsim data (4 items)...');
      await client.query(`
        INSERT INTO cloudsim_produk (
          kategori, tipe_cloudsim, jumlah_provider, negara, package_quota_gb,
          licence_fee, simbank, quota_price, cogs, margin_pct, bottom_line_pct, selling_price, status_kelengkapan, remarks
        ) VALUES 
        (
          'Monthly Charge — 3 Provider', 'Monthly Charge — 3 Provider', 3, 'Domestik', 1,
          32000, 12500, 6500, 51000, 45, 20, 92727, 'Lengkap', 'Cloudsim 3 Operator Domestik'
        ),
        (
          'Monthly Charge — 2 Provider', 'Monthly Charge — 2 Provider', 2, 'Domestik', 1,
          32000, 8333, 6500, 46833, 30, 20, 66904, 'Lengkap', 'Cloudsim 2 Operator Domestik'
        ),
        (
          'Monthly Charge — 1 Provider', 'Monthly Charge — 1 Provider', 1, 'Domestik', 1,
          32000, 4167, 6500, 42667, 30, 20, 60953, 'Lengkap', 'Cloudsim 1 Operator Domestik'
        ),
        (
          'Monthly Charge — 1 Provider Roaming', 'Monthly Charge — 1 Provider Roaming', 1, 'Malaysia', 25,
          35000, NULL, 144500, 179500, 30, 20, 256429, 'Lengkap', 'Cloudsim Roaming Luar Negeri'
        )
      `);
    }

    // 4. Seed Logistik if empty
    const logistikCount = await client.query('SELECT COUNT(*) FROM logistik_produk');
    if (parseInt(logistikCount.rows[0].count, 10) === 0) {
      console.log('Seeding initial Logistik routes...');
      await client.query(`
        INSERT INTO logistik_produk (
          kategori, origin_city_code, origin_city, destination_city_code, destination_city,
          service_type, product_name, start_weight, end_weight, rate_type, range_type,
          publish_rate, markup_percentage, selling_rate, remarks
        ) VALUES 
        (
          'REGPACK', 'ABU', 'ATAMBUA', 'ABU', 'ATAMBUA',
          'package', 'REGPACK', 1, 1000, 'per_kg', 'CHARGEABLE_weight',
          NULL, 40, NULL, 'Publish rate belum terisi dari Excel'
        ),
        (
          'REGPACK', 'ABU', 'ATAMBUA', 'AEG', 'AEK GODANG',
          'package', 'REGPACK', 1, 1000, 'per_kg', 'CHARGEABLE_weight',
          NULL, 40, NULL, 'Publish rate belum terisi dari Excel'
        )
      `);
    }

    await client.query('COMMIT');
    console.log('Initial reference seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedInitial();
