import { Pool } from "pg";

let pool;
let activeConnectionString = null;

export function getPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:kalkulator@localhost:5432/kalkulator_harga_jual";

  if (!pool || activeConnectionString !== connectionString) {
    if (pool) {
      console.log("DATABASE_URL changed, recreating PostgreSQL connection pool...");
      pool.end().catch((e) => console.error("Error closing previous pool:", e));
    }

    activeConnectionString = connectionString;
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

/**
 * Initialize auxiliary tables (settings) and seed default data if empty
 */
export async function initDb() {
  const p = getPool();
  const client = await p.connect();
  try {
    // 1. Create settings table for global assumptions
    await client.query(`
      CREATE TABLE IF NOT EXISTS kalkulator_pengaturan (
        key VARCHAR(50) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Ensure default assumptions exist if missing
    await client.query(`
      INSERT INTO kalkulator_pengaturan (key, value)
      VALUES ('assumptions', $1)
      ON CONFLICT (key) DO NOTHING
    `, [
      JSON.stringify({
        margins: ["30", "25", "20", "15", "10"],
        quantities: ["100", "150", "200", "300", "500"],
        taxEnabled: true,
      }),
    ]);

    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error initializing database:", err);
    throw err;
  } finally {
    client.release();
  }
}
