import { NextResponse } from "next/server";
import { getPool, initDb } from "@/app/lib/db";
import { getProductTypeConfig } from "@/app/lib/productTypes";

// GET /api/products — Fetch products for specified type
export async function GET(request) {
  try {
    await initDb();
    const pool = getPool();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "simcard";
    const typeConfig = getProductTypeConfig(type);
    const { table, tierTable } = typeConfig;

    let result;
    if (type === "simcard") {
      result = await pool.query(`
        SELECT 
          p.*,
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
        FROM ${table} p
        LEFT JOIN ${tierTable} t ON p.id = t.produk_id
        GROUP BY p.id
        ORDER BY p.id ASC
      `);
    } else {
      result = await pool.query(`SELECT * FROM ${table} ORDER BY id ASC`);
    }

    const items = result.rows.map((row) => ({
      ...row,
      id: row.id,
      kategori: row.kategori || "",
      row: [
        row.penyedia || "DPT",
        row.status_stok || "OPEN",
        row.nama_paket || row.provider || row.nama_produk || "",
        row.kuota_gb !== null ? parseFloat(row.kuota_gb) : 0,
        row.cogs !== null ? parseFloat(row.cogs) : 0,
        row.id,
        row.kategori || "",
      ],
    }));

    return NextResponse.json({
      success: true,
      type: typeConfig.id,
      typeLabel: typeConfig.label,
      count: items.length,
      products: items,
      items,
      rows: items.map((p) => p.row),
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/products — Add a single item
export async function POST(request) {
  try {
    const body = await request.json();
    const { type = "simcard" } = body;
    const typeConfig = getProductTypeConfig(type);
    const { table, tierTable } = typeConfig;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      let newItem;

      if (type === "edc_referral") {
        const {
          kategori = "EDC — One Time Charge",
          tipe_transaksi = "ONE_TIME",
          spec_type = "",
          tier_min_qty = 1,
          tier_max_qty = 200,
          selling_price = 0,
          referral_fee_pct = 5,
          simulation_qty = 200,
          remarks = "",
        } = body;
        const sp = parseFloat(selling_price) || 0;
        const feePct = parseFloat(referral_fee_pct) || 0;
        const simQty = parseInt(simulation_qty, 10) || 1;
        const feePerUnit = Math.round(sp * (feePct / 100));
        const totalFee = feePerUnit * simQty;

        const res = await client.query(
          `
          INSERT INTO edc_referral_produk (
            kategori, tipe_transaksi, spec_type, tier_min_qty, tier_max_qty,
            selling_price, referral_fee_pct, referral_fee_per_unit, simulation_qty, total_referral_fee, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `,
          [
            kategori,
            tipe_transaksi,
            spec_type,
            tier_min_qty,
            tier_max_qty,
            sp,
            feePct,
            feePerUnit,
            simQty,
            totalFee,
            remarks,
          ]
        );
        newItem = res.rows[0];
      } else if (type === "router") {
        const {
          kategori = "Beli Putus",
          nama_produk = "",
          jenis_transaksi = "Beli Putus",
          jangka_waktu_sewa = null,
          min_qty = 1,
          max_qty = 9,
          cogs_cku = null,
          cogs_rts = null,
          margin_pct = 45,
          remarks = "",
        } = body;

        const mPct = parseFloat(margin_pct) || 0;
        const rts = cogs_rts !== null && cogs_rts !== "" ? parseFloat(cogs_rts) : null;
        const cku = cogs_cku !== null && cogs_cku !== "" ? parseFloat(cogs_cku) : null;
        let sp = null;
        let gp = null;
        if (rts !== null && rts > 0 && mPct < 100) {
          sp = Math.round((rts / (1 - mPct / 100)) / 5000) * 5000;
          gp = sp - rts;
        }

        const res = await client.query(
          `
          INSERT INTO router_produk (
            kategori, nama_produk, jenis_transaksi, jangka_waktu_sewa,
            min_qty, max_qty, cogs_cku, cogs_rts, margin_pct, selling_price, gross_profit, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `,
          [
            kategori || jenis_transaksi,
            nama_produk,
            jenis_transaksi,
            jangka_waktu_sewa,
            min_qty,
            max_qty,
            cku,
            rts,
            mPct,
            sp,
            gp,
            remarks,
          ]
        );
        newItem = res.rows[0];
      } else if (type === "cloudsim") {
        const {
          kategori = "Monthly Charge — 1 Provider",
          tipe_cloudsim = "Monthly Charge — 1 Provider",
          jumlah_provider = 1,
          negara = "Domestik",
          package_quota_gb = 1,
          licence_fee = null,
          simbank = null,
          quota_price = null,
          margin_pct = 30,
          bottom_line_pct = 20,
          remarks = "",
        } = body;

        const lFee = licence_fee !== null && licence_fee !== "" ? parseFloat(licence_fee) : null;
        const sBank = simbank !== null && simbank !== "" ? parseFloat(simbank) : null;
        const qPrice = quota_price !== null && quota_price !== "" ? parseFloat(quota_price) : null;
        const mPct = parseFloat(margin_pct) || 30;
        const bLine = parseFloat(bottom_line_pct) || 20;

        let cogs = null;
        let sp = null;
        let status = "Lengkap";
        if (lFee !== null && qPrice !== null) {
          cogs = (lFee || 0) + (sBank || 0) + (qPrice || 0);
          if (mPct < 100) sp = Math.round(cogs / (1 - mPct / 100));
        } else {
          status = "Belum Lengkap";
        }

        const res = await client.query(
          `
          INSERT INTO cloudsim_produk (
            kategori, tipe_cloudsim, jumlah_provider, negara, package_quota_gb,
            licence_fee, simbank, quota_price, cogs, margin_pct, bottom_line_pct, selling_price, status_kelengkapan, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `,
          [
            kategori || tipe_cloudsim,
            tipe_cloudsim,
            jumlah_provider,
            negara,
            package_quota_gb,
            lFee,
            sBank,
            qPrice,
            cogs,
            mPct,
            bLine,
            sp,
            status,
            remarks,
          ]
        );
        newItem = res.rows[0];
      } else if (type === "logistik") {
        const {
          kategori = "REGPACK",
          origin_city_code = "",
          origin_city = "",
          destination_city_code = "",
          destination_city = "",
          service_type = "package",
          product_name = "REGPACK",
          start_weight = 1,
          end_weight = 1000,
          rate_type = "per_kg",
          range_type = "CHARGEABLE_weight",
          publish_rate = null,
          markup_percentage = 40,
          remarks = "",
        } = body;

        const pRate = publish_rate !== null && publish_rate !== "" ? parseFloat(publish_rate) : null;
        const mPct = parseFloat(markup_percentage) || 40;
        let sRate = null;
        if (pRate !== null && pRate > 0) {
          sRate = Math.round(pRate * (1 + mPct / 100));
        }

        const res = await client.query(
          `
          INSERT INTO logistik_produk (
            kategori, origin_city_code, origin_city, destination_city_code, destination_city,
            service_type, product_name, start_weight, end_weight, rate_type, range_type,
            publish_rate, markup_percentage, selling_rate, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `,
          [
            kategori || product_name,
            origin_city_code,
            origin_city,
            destination_city_code,
            destination_city,
            service_type,
            product_name,
            start_weight,
            end_weight,
            rate_type,
            range_type,
            pRate,
            mPct,
            sRate,
            remarks,
          ]
        );
        newItem = res.rows[0];
      } else {
        // Simcard
        const {
          kategori,
          penyedia = "DPT",
          status_stok = "OPEN",
          provider = "",
          kuota_gb = 1,
          cogs = 0,
        } = body;
        const finalKategori = kategori ? String(kategori).trim() : null;

        const res = await client.query(
          `
          INSERT INTO simcard_produk (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
          VALUES ($1, $2, $3, $4, $4, $5, $6)
          RETURNING *
        `,
          [finalKategori, penyedia, status_stok, provider, kuota_gb, cogs]
        );
        newItem = res.rows[0];

        const defaultMargins = [30, 25, 20, 15, 10];
        const defaultQuantities = [100, 150, 200, 300, 500];
        for (let t = 1; t <= 5; t++) {
          await client.query(
            `
            INSERT INTO simcard_tier_harga (produk_id, tier_ke, min_unit, margin_persen)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (produk_id, tier_ke) DO NOTHING
          `,
            [newItem.id, t, defaultQuantities[t - 1], defaultMargins[t - 1]]
          );
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        type: typeConfig.id,
        item: newItem,
        product: newItem,
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
    const type = searchParams.get("type") || "simcard";
    const typeConfig = getProductTypeConfig(type);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID produk wajib diisi" },
        { status: 400 }
      );
    }

    const pool = getPool();
    await pool.query(`DELETE FROM ${typeConfig.table} WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: `Data ${typeConfig.label} ID ${id} berhasil dihapus`,
    });
  } catch (error) {
    console.error("DELETE /api/products error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
