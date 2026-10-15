const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kalkulator_produk:cku1nternal@38.47.90.252:5432/kalkulator_db'
});

async function main() {
  try {
    const colRes = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'simcard_produk'
      ORDER BY ordinal_position
    `);
    console.log('COLUMNS simcard_produk:', colRes.rows);

    const conRes = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_class t ON c.conrelid = t.oid 
      WHERE t.relname = 'simcard_produk'
    `);
    console.log('CONSTRAINTS simcard_produk:', conRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
