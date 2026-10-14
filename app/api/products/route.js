import { NextResponse } from "next/server";
import { getPool, initDb } from "@/app/lib/db";

// GET /api/products — Fetch all products and their pricing tiers
export async function GET() {
  try {
    await initDb();
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        p.id,
        p.kategori,
        p.penyedia,
        p.status_stok,
        p.provider,
        p.nama_paket,
        p.kuota_gb,
        p.cogs,
        p.biaya_simcard,
        p.cogs_kuota_bulanan,
        p.harga_tp,
        p.harga_eup,
        p.pajak_persen,
        p.remarks,
        p.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'tier_ke', t.tier_ke,
              'min_unit', t.min_unit,
              'max_unit', t.max_unit,
              'margin_persen', t.margin_persen
            ) ORDER BY t.tier_ke
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tiers
      FROM simcard_produk p
      LEFT JOIN simcard_tier_harga t ON p.id = t.produk_id
      GROUP BY p.id
      ORDER BY p.id ASC
    `);

    // Format products into frontend rows: [penyedia, status_stok, provider, kuota_gb, cogs, id]
    const products = result.rows.map((row) => ({
      id: row.id,
      kategori: row.kategori,
      penyedia: row.penyedia,
      status_stok: row.status_stok,
      provider: row.provider || row.nama_paket || "",
      nama_paket: row.nama_paket || row.provider || "",
      kuota_gb: row.kuota_gb !== null ? parseFloat(row.kuota_gb) : 0,
      cogs: row.cogs !== null ? parseFloat(row.cogs) : 0,
      tiers: row.tiers,
      // Frontend table row array format
      row: [
        row.penyedia || "DPT",
        row.status_stok || "OPEN",
        row.nama_paket || row.provider || "",
        row.kuota_gb !== null ? parseFloat(row.kuota_gb) : 0,
        row.cogs !== null ? parseFloat(row.cogs) : 0,
        row.id,
      ],
    }));

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
      rows: products.map((p) => p.row),
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/products — Sync all products from table to database
export async function PUT(request) {
  try {
    const body = await request.json();
    const { rows, margins, quantities } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: "Data rows harus berupa array" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Valid categories from DB check constraint
      const VALID_CATEGORIES = ["IOT_M2M", "POSTPAID", "PREPAID", "SPI", "PAYU"];
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
          // Check if product exists
          const checkRes = await client.query(
            "SELECT id FROM simcard_produk WHERE id = $1",
            [existingId]
          );

          if (checkRes.rows.length > 0) {
            // Update existing product
            await client.query(
              `
              UPDATE simcard_produk
              SET penyedia = $1, status_stok = $2, provider = $3, nama_paket = $4, kuota_gb = $5, cogs = $6
              WHERE id = $7
            `,
              [
                penyedia,
                statusStok,
                providerName,
                providerName,
                kuota,
                cogs,
                existingId,
              ]
            );
            prodId = existingId;
          } else {
            // Insert new product
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
          // Insert new product
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

        // Update 5 tiers in simcard_tier_harga if margins & quantities provided
        if (Array.isArray(margins) && Array.isArray(quantities)) {
          for (let t = 1; t <= 5; t++) {
            const minUnit = parseInt(quantities[t - 1], 10) || (t * 100);
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

      // Delete any products that were deleted in the UI (only if rows was not empty)
      if (savedIds.length > 0) {
        await client.query(
          "DELETE FROM simcard_produk WHERE id != ALL($1::bigint[])",
          [savedIds]
        );
      } else if (rows.length === 0) {
        await client.query("DELETE FROM simcard_produk");
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Data produk dan tier harga berhasil disimpan ke database",
        savedIds,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("PUT /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/products — Add a single product
export async function POST(request) {
  try {
    const body = await request.json();
    const { penyedia = "DPT", status_stok = "OPEN", provider = "", kuota_gb = 1, cogs = 0 } = body;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const insertRes = await client.query(
        `
        INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
        VALUES ('PREPAID', $1, $2, $3, $3, $4, $5)
        RETURNING id, kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs
      `,
        [penyedia, status_stok, provider, kuota_gb, cogs]
      );

      const newProd = insertRes.rows[0];

      // Insert default 5 tiers
      const defaultMargins = [30, 25, 20, 15, 10];
      const defaultQuantities = [100, 150, 200, 300, 500];
      for (let t = 1; t <= 5; t++) {
        await client.query(
          `
          INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
          VALUES ($1, $2, $3, $4)
        `,
          [newProd.id, t, defaultQuantities[t - 1], defaultMargins[t - 1]]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        product: newProd,
        row: [penyedia, status_stok, provider, kuota_gb, cogs, newProd.id],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/products — Delete product by ID
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID produk wajib diisi" },
        { status: 400 }
      );
    }

    const pool = getPool();
    await pool.query("DELETE FROM simcard_produk WHERE id = $1", [id]);

    return NextResponse.json({
      success: true,
      message: `Produk ID ${id} berhasil dihapus dari database`,
    });
  } catch (error) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
