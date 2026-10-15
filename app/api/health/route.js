import { NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";

export async function GET() {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port,
        NOW() AS server_time,
        (SELECT COUNT(*) FROM simcard_produk) AS product_count,
        (SELECT COUNT(*) FROM simcard_tier_harga) AS tier_count
    `);

    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      status: "connected",
      database: row.database_name,
      host: `${row.server_address}:${row.server_port}`,
      latencyMs: Date.now() - startTime,
      serverTime: row.server_time,
      counts: {
        simcard_produk: parseInt(row.product_count, 10),
        simcard_tier_harga: parseInt(row.tier_count, 10),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, status: "error", error: error.message },
      { status: 500 }
    );
  }
}
