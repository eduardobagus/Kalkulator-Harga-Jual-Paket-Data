import { Pool } from "pg";

let pool;

export function getPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://postgres:kalkulator@localhost:5432/kalkulator_harga_jual";

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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

    // 2. Check if simcard_produk has data
    const countRes = await client.query("SELECT COUNT(*) FROM simcard_produk");
    const count = parseInt(countRes.rows[0].count, 10);

    if (count === 0) {
      console.log("Database simcard_produk is empty. Seeding initial data...");
      await client.query("BEGIN");

      const seedProducts = [
        {
          kategori: "PREPAID",
          penyedia: "DPT",
          status_stok: "CLOSED",
          provider: "Telkomsel",
          nama_paket: "Telkomsel 0.5 GB",
          kuota_gb: 0.5,
          cogs: 55500,
        },
        {
          kategori: "PREPAID",
          penyedia: "DPT",
          status_stok: "CLOSED",
          provider: "Telkomsel",
          nama_paket: "Telkomsel 1 GB",
          kuota_gb: 1,
          cogs: 15000,
        },
        {
          kategori: "PREPAID",
          penyedia: "RTS",
          status_stok: "OPEN",
          provider: "Telkomsel",
          nama_paket: "Telkomsel Individual Sharing 2 GB",
          kuota_gb: 2,
          cogs: 36000,
        },
        {
          kategori: "PREPAID",
          penyedia: "RTS",
          status_stok: "OPEN",
          provider: "Telkomsel",
          nama_paket: "Telkomsel Individual Sharing 5 GB",
          kuota_gb: 5,
          cogs: 75000,
        },
        {
          kategori: "PREPAID",
          penyedia: "DPT",
          status_stok: "OPEN",
          provider: "Telkomsel",
          nama_paket: "Telkomsel Individual Package 3 GB",
          kuota_gb: 3,
          cogs: 32500,
        },
      ];

      const defaultMargins = [30, 25, 20, 15, 10];
      const defaultQuantities = [100, 150, 200, 300, 500];

      for (const prod of seedProducts) {
        const insertRes = await client.query(
          `
          INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
          [
            prod.kategori,
            prod.penyedia,
            prod.status_stok,
            prod.provider,
            prod.nama_paket,
            prod.kuota_gb,
            prod.cogs,
          ]
        );

        const prodId = insertRes.rows[0].id;

        // Insert 5 tiers for each product
        for (let t = 1; t <= 5; t++) {
          await client.query(
            `
            INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
            VALUES ($1, $2, $3, $4)
          `,
            [prodId, t, defaultQuantities[t - 1], defaultMargins[t - 1]]
          );
        }
      }

      // Seed default assumptions
      await client.query(
        `
        INSERT INTO kalkulator_pengaturan (key, value)
        VALUES ('assumptions', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `,
        [
          JSON.stringify({
            margins: ["30", "25", "20", "15", "10"],
            quantities: ["100", "150", "200", "300", "500"],
            taxEnabled: true,
          }),
        ]
      );

      await client.query("COMMIT");
      console.log("Seeding completed successfully.");
    }

    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error initializing database:", err);
    throw err;
  } finally {
    client.release();
  }
}
