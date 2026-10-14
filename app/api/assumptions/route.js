import { NextResponse } from "next/server";
import { getPool, initDb } from "@/app/lib/db";

// GET /api/assumptions — Get saved scenario margins, quantities, and tax toggle
export async function GET() {
  try {
    await initDb();
    const pool = getPool();

    const res = await pool.query(
      "SELECT value FROM kalkulator_pengaturan WHERE key = 'assumptions'"
    );

    if (res.rows.length > 0) {
      return NextResponse.json({
        success: true,
        assumptions: res.rows[0].value,
      });
    }

    const defaultAssumptions = {
      margins: ["30", "25", "20", "15", "10"],
      quantities: ["100", "150", "200", "300", "500"],
      taxEnabled: true,
    };

    return NextResponse.json({
      success: true,
      assumptions: defaultAssumptions,
    });
  } catch (error) {
    console.error("GET /api/assumptions error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/assumptions — Save scenario margins, quantities, and tax toggle
export async function POST(request) {
  try {
    const body = await request.json();
    const { margins, quantities, taxEnabled } = body;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Save to settings table
      await client.query(
        `
        INSERT INTO kalkulator_pengaturan (key, value)
        VALUES ('assumptions', $1)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `,
        [JSON.stringify({ margins, quantities, taxEnabled })]
      );

      // 2. Synchronize all products' tiers in simcard_tier_harga
      if (Array.isArray(margins) && Array.isArray(quantities)) {
        const prodRes = await client.query("SELECT id FROM simcard_produk");
        for (const prod of prodRes.rows) {
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
              [prod.id, t, minUnit, marginPersen]
            );
          }
        }
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Asumsi skenario berhasil disimpan ke database",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/assumptions error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
