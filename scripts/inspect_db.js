const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kalkulator@localhost:5432/kalkulator_harga_jual'
});

async function main() {
  try {
    const checkConstraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
    `);
    console.log('All constraints:');
    checkConstraints.rows.forEach(r => console.log(`${r.conname}: ${r.def}`));

    // Check if id has identity
    const identityCols = await pool.query(`
      SELECT table_name, column_name, is_identity, identity_generation
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    console.log('\nIdentity columns:', identityCols.rows.filter(r => r.is_identity === 'YES'));

    await pool.end();
  } catch (e) {
    console.error(e);
  }
}

main();
