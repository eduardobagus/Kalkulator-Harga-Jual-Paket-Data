import { NextResponse } from "next/server";
import { getPool, initDb } from "@/app/lib/db";

// Helper to execute with automatic retry on deadlock (PostgreSQL error code 40P01)
async function executeWithRetry(fn, maxRetries = 3) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempts++;
      if (err.code === "40P01" && attempts < maxRetries) {
        console.warn(`[Sync] Deadlock detected. Retrying attempt ${attempts}/${maxRetries}...`);
        await new Promise((res) => setTimeout(res, 50 * attempts + Math.random() * 50));
      } else {
        throw err;
      }
    }
  }
}

// POST /api/sync — Unified atomic save for products, tiers, and assumptions
export async function POST(request) {
  try {
    await initDb();
    const body = await request.json();
    const { rows, margins, quantities, taxEnabled } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: "Data rows harus berupa array" },
        { status: 400 }
      );
    }

    const pool = getPool();

    const result = await executeWithRetry(async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Save global assumptions in kalkulator_pengaturan
        if (Array.isArray(margins) && Array.isArray(quantities)) {
          await client.query(
            `
            INSERT INTO kalkulator_pengaturan (key, value)
            VALUES ('assumptions', $1)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          `,
            [JSON.stringify({ margins, quantities, taxEnabled: Boolean(taxEnabled) })]
          );
        }

        // 2. Sync products in simcard_produk
        const VALID_STATUSES = ["OPEN", "CLOSED"];
        const savedIds = [];

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          const penyedia = String(row[0] || "DPT").trim();
          const rawStatus = String(row[1] || "OPEN").trim().toUpperCase();
          const statusStok = VALID_STATUSES.includes(rawStatus) ? rawStatus : "OPEN";
          const providerName = String(row[2] || "").trim();
          const kuota = parseFloat(row[3]) || 0;
          const cogs = parseFloat(row[4]) || 0;
          const existingId = row[5] ? parseInt(row[5], 10) : null;
          const kategori = "PREPAID";

          let prodId;

          if (existingId && !isNaN(existingId)) {
            const checkRes = await client.query(
              "SELECT id FROM simcard_produk WHERE id = $1",
              [existingId]
            );

            if (checkRes.rows.length > 0) {
              await client.query(
                `
                UPDATE simcard_produk
                SET penyedia = $1, status_stok = $2, provider = $3, nama_paket = $4, kuota_gb = $5, cogs = $6
                WHERE id = $7
              `,
                [penyedia, statusStok, providerName, providerName, kuota, cogs, existingId]
              );
              prodId = existingId;
            } else {
              const insertRes = await client.query(
                `
                INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
              `,
                [kategori, penyedia, statusStok, providerName, providerName, kuota, cogs]
              );
              prodId = insertRes.rows[0].id;
            }
          } else {
            const insertRes = await client.query(
              `
              INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id
            `,
              [kategori, penyedia, statusStok, providerName, providerName, kuota, cogs]
            );
            prodId = insertRes.rows[0].id;
          }

          savedIds.push(prodId);
        }

        // 3. Delete products that were removed from the UI
        if (savedIds.length > 0) {
          await client.query(
            "DELETE FROM simcard_produk WHERE id != ALL($1::bigint[])",
            [savedIds]
          );
        } else if (rows.length === 0) {
          await client.query("DELETE FROM simcard_produk");
        }

        // 4. Update tiers in simcard_tier_harga in deterministic sorted order
        if (Array.isArray(margins) && Array.isArray(quantities) && savedIds.length > 0) {
          // Sort IDs deterministically to prevent deadlocks across concurrent saves
          const sortedIds = [...savedIds].sort((a, b) => a - b);

          for (const prodId of sortedIds) {
            for (let t = 1; t <= 5; t++) {
              const minUnit = parseInt(quantities[t - 1], 10) || t * 100;
              const marginPersen = parseFloat(margins[t - 1]) || 20;

              await client.query(
                `
                INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (produk_id, tier_ke)
                DO UPDATE SET min_unit = EXCLUDED.min_unit, margin_persen = EXCLUDED.margin_persen
              `,
                [prodId, t, minUnit, marginPersen]
              );
            }
          }
        }

        await client.query("COMMIT");
        return { savedIds };
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });

    return NextResponse.json({
      success: true,
      message: "Data dan skenario berhasil disinkronkan ke PostgreSQL",
      savedIds: result.savedIds,
    });
  } catch (error) {
    console.error("POST /api/sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
