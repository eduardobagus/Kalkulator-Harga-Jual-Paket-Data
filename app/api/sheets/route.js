import { NextResponse } from "next/server";
import {
  pushToSheets,
  pullFromSheets,
  checkSheetsHealth,
  saveConfig,
  deleteConfig,
} from "@/app/lib/sheets";
import { initDb } from "@/app/lib/db";

// GET /api/sheets — Check connection status or pull data from Sheets
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  try {
    await initDb();

    if (action === "pull") {
      const result = await pullFromSheets();
      return NextResponse.json({ success: true, ...result });
    }

    // Default: health check
    const health = await checkSheetsHealth();
    return NextResponse.json({ success: true, ...health });
  } catch (error) {
    console.error("GET /api/sheets error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/sheets — Push data OR save config
export async function POST(request) {
  try {
    await initDb();
    const body = await request.json();

    // If body contains 'config', save credentials to database
    if (body.config) {
      const { email, privateKey, spreadsheetId, sheetName } = body.config;

      if (!email || !privateKey || !spreadsheetId) {
        return NextResponse.json(
          {
            success: false,
            error: "Email, Private Key, dan Spreadsheet ID wajib diisi",
          },
          { status: 400 }
        );
      }

      await saveConfig({ email, privateKey, spreadsheetId, sheetName });

      // Immediately test connection
      const health = await checkSheetsHealth();

      return NextResponse.json({
        success: true,
        message: "Konfigurasi Google Sheets berhasil disimpan",
        ...health,
      });
    }

    // Otherwise: push data to Sheets
    const { rows, margins, quantities, taxEnabled } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { success: false, error: "Data rows harus berupa array" },
        { status: 400 }
      );
    }

    const result = await pushToSheets({
      rows,
      margins,
      quantities,
      taxEnabled: Boolean(taxEnabled),
    });

    return NextResponse.json({
      success: true,
      message: `${result.rowCount} produk berhasil disinkronkan ke Google Sheets`,
      spreadsheetUrl: result.spreadsheetUrl,
      rowCount: result.rowCount,
    });
  } catch (error) {
    console.error("POST /api/sheets error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/sheets — Remove saved config from database
export async function DELETE() {
  try {
    await initDb();
    await deleteConfig();

    return NextResponse.json({
      success: true,
      message: "Konfigurasi Google Sheets berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE /api/sheets error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
