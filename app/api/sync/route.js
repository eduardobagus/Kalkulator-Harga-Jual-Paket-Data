import { NextResponse } from "next/server";
import { getPool, initDb } from "@/app/lib/db";
import { getProductTypeConfig } from "@/app/lib/productTypes";

// Helper to execute with automatic retry on deadlock
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

// POST /api/sync — Unified atomic save for any product type
export async function POST(request) {
  try {
    await initDb();
    const body = await request.json();
    const {
      type = "simcard",
      items,
      rows,
      margins,
      quantities,
      taxEnabled,
      allowClear = false,
    } = body;

    const typeConfig = getProductTypeConfig(type);
    const { table, tierTable } = typeConfig;
    const pool = getPool();

    const result = await executeWithRetry(async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Save global assumptions if provided
        if (Array.isArray(margins) && Array.isArray(quantities)) {
          const assumpVal = JSON.stringify({ margins, quantities, taxEnabled: Boolean(taxEnabled) });
          await client.query(
            `
            INSERT INTO kalkulator_pengaturan (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          `,
            [`assumptions_${typeConfig.id}`, assumpVal]
          );

          await client.query(
            `
            INSERT INTO kalkulator_pengaturan (key, value)
            VALUES ('assumptions', $1)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
          `,
            [assumpVal]
          );
        }

        const savedIds = [];

        // 2. Type-specific saving
        if (type === "edc_referral" && Array.isArray(items)) {
          for (const item of items) {
            const sp = parseFloat(item.selling_price) || 0;
            const feePct = parseFloat(item.referral_fee_pct) || 0;
            const simQty = parseInt(item.simulation_qty, 10) || 1;
            const feePerUnit = Math.round(sp * (feePct / 100));
            const totalFee = feePerUnit * simQty;
            const existingId = item.id ? parseInt(item.id, 10) : null;

            if (existingId) {
              await client.query(
                `
                UPDATE edc_referral_produk
                SET kategori = $1, tipe_transaksi = $2, spec_type = $3, tier_min_qty = $4, tier_max_qty = $5,
                    selling_price = $6, referral_fee_pct = $7, referral_fee_per_unit = $8, simulation_qty = $9,
                    total_referral_fee = $10, remarks = $11, updated_at = CURRENT_TIMESTAMP
                WHERE id = $12
              `,
                [
                  item.kategori || "EDC — One Time Charge",
                  item.tipe_transaksi || "ONE_TIME",
                  item.spec_type || "",
                  item.tier_min_qty || 1,
                  item.tier_max_qty || 200,
                  sp,
                  feePct,
                  feePerUnit,
                  simQty,
                  totalFee,
                  item.remarks || "",
                  existingId,
                ]
              );
              savedIds.push(existingId);
            } else {
              const ins = await client.query(
                `
                INSERT INTO edc_referral_produk (
                  kategori, tipe_transaksi, spec_type, tier_min_qty, tier_max_qty,
                  selling_price, referral_fee_pct, referral_fee_per_unit, simulation_qty, total_referral_fee, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
              `,
                [
                  item.kategori || "EDC — One Time Charge",
                  item.tipe_transaksi || "ONE_TIME",
                  item.spec_type || "",
                  item.tier_min_qty || 1,
                  item.tier_max_qty || 200,
                  sp,
                  feePct,
                  feePerUnit,
                  simQty,
                  totalFee,
                  item.remarks || "",
                ]
              );
              savedIds.push(ins.rows[0].id);
            }
          }
        } else if (type === "router" && Array.isArray(items)) {
          for (const item of items) {
            const mPct = parseFloat(item.margin_pct) || 0;
            const rts = item.cogs_rts !== null && item.cogs_rts !== "" && !isNaN(parseFloat(item.cogs_rts)) ? parseFloat(item.cogs_rts) : null;
            const cku = item.cogs_cku !== null && item.cogs_cku !== "" && !isNaN(parseFloat(item.cogs_cku)) ? parseFloat(item.cogs_cku) : null;
            let sp = null;
            let gp = null;
            if (rts !== null && rts > 0 && mPct < 100) {
              sp = Math.round((rts / (1 - mPct / 100)) / 5000) * 5000;
              gp = sp - rts;
            }
            const existingId = item.id ? parseInt(item.id, 10) : null;

            if (existingId) {
              await client.query(
                `
                UPDATE router_produk
                SET kategori = $1, nama_produk = $2, jenis_transaksi = $3, jangka_waktu_sewa = $4,
                    min_qty = $5, max_qty = $6, cogs_cku = $7, cogs_rts = $8, margin_pct = $9,
                    selling_price = $10, gross_profit = $11, remarks = $12, updated_at = CURRENT_TIMESTAMP
                WHERE id = $13
              `,
                [
                  item.kategori || item.jenis_transaksi || "Beli Putus",
                  item.nama_produk || "",
                  item.jenis_transaksi || "Beli Putus",
                  item.jangka_waktu_sewa || null,
                  item.min_qty || 1,
                  item.max_qty || 9,
                  cku,
                  rts,
                  mPct,
                  sp,
                  gp,
                  item.remarks || "",
                  existingId,
                ]
              );
              savedIds.push(existingId);
            } else {
              const ins = await client.query(
                `
                INSERT INTO router_produk (
                  kategori, nama_produk, jenis_transaksi, jangka_waktu_sewa,
                  min_qty, max_qty, cogs_cku, cogs_rts, margin_pct, selling_price, gross_profit, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
              `,
                [
                  item.kategori || item.jenis_transaksi || "Beli Putus",
                  item.nama_produk || "",
                  item.jenis_transaksi || "Beli Putus",
                  item.jangka_waktu_sewa || null,
                  item.min_qty || 1,
                  item.max_qty || 9,
                  cku,
                  rts,
                  mPct,
                  sp,
                  gp,
                  item.remarks || "",
                ]
              );
              savedIds.push(ins.rows[0].id);
            }
          }
        } else if (type === "cloudsim" && Array.isArray(items)) {
          for (const item of items) {
            const lFee = item.licence_fee !== null && item.licence_fee !== "" && !isNaN(parseFloat(item.licence_fee)) ? parseFloat(item.licence_fee) : null;
            const sBank = item.simbank !== null && item.simbank !== "" && !isNaN(parseFloat(item.simbank)) ? parseFloat(item.simbank) : null;
            const qPrice = item.quota_price !== null && item.quota_price !== "" && !isNaN(parseFloat(item.quota_price)) ? parseFloat(item.quota_price) : null;
            const mPct = parseFloat(item.margin_pct) || 30;
            const bLine = parseFloat(item.bottom_line_pct) || 20;

            let cogs = null;
            let sp = null;
            let status = "Lengkap";
            if (lFee !== null && qPrice !== null) {
              cogs = (lFee || 0) + (sBank || 0) + (qPrice || 0);
              if (mPct < 100) sp = Math.round(cogs / (1 - mPct / 100));
            } else {
              status = "Belum Lengkap";
            }
            const existingId = item.id ? parseInt(item.id, 10) : null;

            if (existingId) {
              await client.query(
                `
                UPDATE cloudsim_produk
                SET kategori = $1, tipe_cloudsim = $2, jumlah_provider = $3, negara = $4, package_quota_gb = $5,
                    licence_fee = $6, simbank = $7, quota_price = $8, cogs = $9, margin_pct = $10,
                    bottom_line_pct = $11, selling_price = $12, status_kelengkapan = $13, remarks = $14, updated_at = CURRENT_TIMESTAMP
                WHERE id = $15
              `,
                [
                  item.kategori || item.tipe_cloudsim || "Monthly Charge — 1 Provider",
                  item.tipe_cloudsim || "Monthly Charge — 1 Provider",
                  item.jumlah_provider || 1,
                  item.negara || "Domestik",
                  item.package_quota_gb || 1,
                  lFee,
                  sBank,
                  qPrice,
                  cogs,
                  mPct,
                  bLine,
                  sp,
                  status,
                  item.remarks || "",
                  existingId,
                ]
              );
              savedIds.push(existingId);
            } else {
              const ins = await client.query(
                `
                INSERT INTO cloudsim_produk (
                  kategori, tipe_cloudsim, jumlah_provider, negara, package_quota_gb,
                  licence_fee, simbank, quota_price, cogs, margin_pct, bottom_line_pct, selling_price, status_kelengkapan, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id
              `,
                [
                  item.kategori || item.tipe_cloudsim || "Monthly Charge — 1 Provider",
                  item.tipe_cloudsim || "Monthly Charge — 1 Provider",
                  item.jumlah_provider || 1,
                  item.negara || "Domestik",
                  item.package_quota_gb || 1,
                  lFee,
                  sBank,
                  qPrice,
                  cogs,
                  mPct,
                  bLine,
                  sp,
                  status,
                  item.remarks || "",
                ]
              );
              savedIds.push(ins.rows[0].id);
            }
          }
        } else if (type === "logistik" && Array.isArray(items)) {
          for (const item of items) {
            const pRate = item.publish_rate !== null && item.publish_rate !== "" && !isNaN(parseFloat(item.publish_rate)) ? parseFloat(item.publish_rate) : null;
            const mPct = parseFloat(item.markup_percentage) || 40;
            let sRate = null;
            if (pRate !== null && pRate > 0) {
              sRate = Math.round(pRate * (1 + mPct / 100));
            }
            const existingId = item.id ? parseInt(item.id, 10) : null;

            if (existingId) {
              await client.query(
                `
                UPDATE logistik_produk
                SET kategori = $1, origin_city_code = $2, origin_city = $3, destination_city_code = $4, destination_city = $5,
                    service_type = $6, product_name = $7, start_weight = $8, end_weight = $9, rate_type = $10,
                    range_type = $11, publish_rate = $12, markup_percentage = $13, selling_rate = $14, remarks = $15, updated_at = CURRENT_TIMESTAMP
                WHERE id = $16
              `,
                [
                  item.kategori || item.product_name || "REGPACK",
                  item.origin_city_code || "",
                  item.origin_city || "",
                  item.destination_city_code || "",
                  item.destination_city || "",
                  item.service_type || "package",
                  item.product_name || "REGPACK",
                  item.start_weight || 1,
                  item.end_weight || 1000,
                  item.rate_type || "per_kg",
                  item.range_type || "CHARGEABLE_weight",
                  pRate,
                  mPct,
                  sRate,
                  item.remarks || "",
                  existingId,
                ]
              );
              savedIds.push(existingId);
            } else {
              const ins = await client.query(
                `
                INSERT INTO logistik_produk (
                  kategori, origin_city_code, origin_city, destination_city_code, destination_city,
                  service_type, product_name, start_weight, end_weight, rate_type, range_type,
                  publish_rate, markup_percentage, selling_rate, remarks
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
              `,
                [
                  item.kategori || item.product_name || "REGPACK",
                  item.origin_city_code || "",
                  item.origin_city || "",
                  item.destination_city_code || "",
                  item.destination_city || "",
                  item.service_type || "package",
                  item.product_name || "REGPACK",
                  item.start_weight || 1,
                  item.end_weight || 1000,
                  item.rate_type || "per_kg",
                  item.range_type || "CHARGEABLE_weight",
                  pRate,
                  mPct,
                  sRate,
                  item.remarks || "",
                ]
              );
              savedIds.push(ins.rows[0].id);
            }
          }
        } else {
          // Simcard rows
          const rowsToSync = Array.isArray(rows) ? rows : [];
          const VALID_STATUSES = ["OPEN", "CLOSED"];

          for (let idx = 0; idx < rowsToSync.length; idx++) {
            const row = rowsToSync[idx];
            const penyedia = String(row[0] || "DPT").trim();
            const rawStatus = String(row[1] || "OPEN").trim().toUpperCase();
            const statusStok = VALID_STATUSES.includes(rawStatus) ? rawStatus : "OPEN";
            const providerName = String(row[2] || "").trim();
            const kuota = parseFloat(row[3]) || 0;
            const cogs = parseFloat(row[4]) || 0;
            const existingId = row[5] ? parseInt(row[5], 10) : null;
            const rawKategori = row[6] !== undefined && row[6] !== null ? String(row[6]).trim() : "";
            const kategori = rawKategori || null;

            let prodId;
            if (existingId && !isNaN(existingId)) {
              const checkRes = await client.query(`SELECT id FROM ${table} WHERE id = $1`, [existingId]);
              if (checkRes.rows.length > 0) {
                await client.query(
                  `
                  UPDATE ${table}
                  SET penyedia = $1, status_stok = $2, provider = $3, nama_paket = $4, kuota_gb = $5, cogs = $6, kategori = $7
                  WHERE id = $8
                `,
                  [penyedia, statusStok, providerName, providerName, kuota, cogs, kategori, existingId]
                );
                prodId = existingId;
              } else {
                const insertRes = await client.query(
                  `
                  INSERT INTO ${table} (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
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
                INSERT INTO ${table} (kategori, penyedia, status_stok, provider, nama_paket, kuota_gb, cogs)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
              `,
                [kategori, penyedia, statusStok, providerName, providerName, kuota, cogs]
              );
              prodId = insertRes.rows[0].id;
            }

            savedIds.push(prodId);
          }

          // Update tiers for Simcard
          if (Array.isArray(margins) && Array.isArray(quantities) && savedIds.length > 0) {
            const sortedIds = [...savedIds].sort((a, b) => a - b);
            for (const prodId of sortedIds) {
              for (let t = 1; t <= 5; t++) {
                const minUnit = parseInt(quantities[t - 1], 10) || t * 100;
                const marginPersen = parseFloat(margins[t - 1]) || 20;

                await client.query(
                  `
                  INSERT INTO ${tierTable} (produk_id, tier_ke, min_unit, margin_persen)
                  VALUES ($1, $2, $3, $4)
                  ON CONFLICT (produk_id, tier_ke)
                  DO UPDATE SET min_unit = EXCLUDED.min_unit, margin_persen = EXCLUDED.margin_persen
                `,
                  [prodId, t, minUnit, marginPersen]
                );
              }
            }
          }
        }

        // Delete removed items
        if (savedIds.length > 0) {
          await client.query(`DELETE FROM ${table} WHERE id != ALL($1::bigint[])`, [savedIds]);
        } else if (allowClear) {
          await client.query(`DELETE FROM ${table}`);
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
      type: typeConfig.id,
      message: `Data ${typeConfig.label} berhasil disinkronkan ke PostgreSQL`,
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
