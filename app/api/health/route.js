import { NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";

export async function GET() {
  const startTime = Date.now();
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        NOW() as server_time,
        (SELECT COUNT(*) FROM simcard_produk) as product_count,
        (SELECT COUNT(*) FROM simcard_tier_harga) as tier_count
    `);

    const latency = Date.now() - startTime;
    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      status: "connected",
      database: "kalkulator_harga_jual",
      host: "localhost:5432",
      latencyMs: latency,
      serverTime: row.server_time,
      counts: {
        simcard_produk: parseInt(row.product_count, 10),
        simcard_tier_harga: parseInt(row.tier_count, 10),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "disconnected",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
