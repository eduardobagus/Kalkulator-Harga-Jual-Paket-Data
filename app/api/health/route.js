import { NextResponse } from "next/server";
import { getPool } from "@/app/lib/db";

export async function GET() {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        NOW() as server_time,
        current_database() as database_name,
        current_user as database_user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port,
        (SELECT COUNT(*) FROM simcard_produk) as simcard_count,
        (SELECT COUNT(*) FROM edc_referral_produk) as edc_count,
        (SELECT COUNT(*) FROM router_produk) as router_count,
        (SELECT COUNT(*) FROM cloudsim_produk) as cloudsim_count,
        (SELECT COUNT(*) FROM logistik_produk) as logistik_count
    `);

    const row = result.rows[0];

    // Determine host from server address or DATABASE_URL
    let host = "localhost:5432";
    if (row.server_address && row.server_port) {
      host = `${row.server_address}:${row.server_port}`;
    } else {
      try {
        const url = new URL(process.env.DATABASE_URL || "");
        host = `${url.hostname}${url.port ? `:${url.port}` : ""}`;
      } catch {
        // fallback
      }
    }

    return NextResponse.json({
      success: true,
      status: "connected",
      database: row.database_name || "kalkulator_db",
      user: row.database_user,
      host,
      latencyMs: Date.now() - startTime,
      serverTime: row.server_time,
      counts: {
        simcard: parseInt(row.simcard_count, 10) || 0,
        edc_referral: parseInt(row.edc_count, 10) || 0,
        router: parseInt(row.router_count, 10) || 0,
        cloudsim: parseInt(row.cloudsim_count, 10) || 0,
        logistik: parseInt(row.logistik_count, 10) || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, status: "error", error: error.message },
      { status: 500 }
    );
  }
}
