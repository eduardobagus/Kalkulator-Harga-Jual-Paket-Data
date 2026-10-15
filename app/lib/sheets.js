import { google } from "googleapis";
import { getPool } from "@/app/lib/db";

/**
 * Google Sheets integration service.
 *
 * Credentials are loaded in this priority order:
 *   1. Database (kalkulator_pengaturan, key = 'sheets_config')
 *   2. Environment variables (.env.local) as fallback
 *
 * This allows users to configure credentials directly from the web UI
 * without needing access to .env.local or server restarts.
 */

const DEFAULT_SHEET_NAME = "Data Produk";

// ─── Config management (DB + env fallback) ───────────────────────────

/**
 * Load sheets config from database, falling back to env vars.
 * @returns {{ email, privateKey, spreadsheetId, sheetName } | null}
 */
export async function loadConfig() {
  // 1. Try database first
  try {
    const pool = getPool();
    const res = await pool.query(
      "SELECT value FROM kalkulator_pengaturan WHERE key = 'sheets_config'"
    );
    if (res.rows.length > 0) {
      const cfg = res.rows[0].value;
      if (cfg.email && cfg.privateKey && cfg.spreadsheetId) {
        return {
          email: cfg.email,
          privateKey: cfg.privateKey.replace(/\\n/g, "\n"),
          spreadsheetId: cfg.spreadsheetId,
          sheetName: cfg.sheetName || DEFAULT_SHEET_NAME,
          source: "database",
        };
      }
    }
  } catch (err) {
    console.warn("[Sheets] Could not load config from DB:", err.message);
  }

  // 2. Fallback to environment variables
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (email && rawKey && spreadsheetId) {
    return {
      email,
      privateKey: rawKey.replace(/\\n/g, "\n"),
      spreadsheetId,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || DEFAULT_SHEET_NAME,
      source: "env",
    };
  }

  return null;
}

/**
 * Save sheets config to database.
 * @param {{ email: string, privateKey: string, spreadsheetId: string, sheetName?: string }} config
 */
export async function saveConfig(config) {
  const pool = getPool();
  const value = {
    email: config.email.trim(),
    privateKey: config.privateKey.trim(),
    spreadsheetId: config.spreadsheetId.trim(),
    sheetName: (config.sheetName || DEFAULT_SHEET_NAME).trim(),
  };

  await pool.query(
    `INSERT INTO kalkulator_pengaturan (key, value)
     VALUES ('sheets_config', $1)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(value)]
  );

  return value;
}

/**
 * Delete sheets config from database.
 */
export async function deleteConfig() {
  const pool = getPool();
  await pool.query(
    "DELETE FROM kalkulator_pengaturan WHERE key = 'sheets_config'"
  );
}

// ─── Auth (dynamic, based on loaded config) ──────────────────────────

function createAuth(config) {
  return new google.auth.JWT(config.email, null, config.privateKey, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

function createSheetsApi(config) {
  const auth = createAuth(config);
  return google.sheets({ version: "v4", auth });
}

// ─── Push: Web → Google Sheets ───────────────────────────────────────

/**
 * Push all product data (with calculated prices) to Google Sheets.
 * Completely replaces sheet content to mirror the web app.
 */
export async function pushToSheets({ rows, margins, quantities, taxEnabled }) {
  const config = await loadConfig();
  if (!config) {
    throw new Error("Google Sheets belum dikonfigurasi");
  }

  const sheets = createSheetsApi(config);
  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName;

  // Build header
  const headerRow1 = ["Kalkulator Harga Jual Paket Data — Sync Otomatis"];
  const headerRow2 = [
    `Terakhir diupdate: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
    `Pajak: ${taxEnabled ? "Aktif" : "Nonaktif"}`,
  ];

  const columnHeaders = [
    "No",
    "Penyedia",
    "Status Stok",
    "Provider / Nama Paket",
    "Kuota (GB)",
    "COGS (Rp)",
  ];

  if (taxEnabled) {
    columnHeaders.push("Tarif Pajak", "COGS + Pajak (Rp)");
  }

  for (let i = 0; i < 5; i++) {
    const q = quantities[i] || "0";
    const m = margins[i] || "0";
    columnHeaders.push(
      `Harga Jual S${i + 1} (${q} unit · ${m}%)`,
      `Margin Aktual S${i + 1}`
    );
  }

  // Build data rows
  const dataRows = rows.map((row, idx) => {
    const penyedia = String(row[0] || "DPT").trim();
    const statusStok = String(row[1] || "OPEN").trim();
    const provider = String(row[2] || "").trim();
    const kuota = parseFloat(row[3]) || 0;
    const cogs = parseFloat(row[4]) || 0;

    const isRTS = penyedia.toUpperCase() === "RTS";
    const taxRate = taxEnabled ? (isRTS ? 0.11 : 0.115) : 0;
    const taxAmount = Math.round(cogs * taxRate);
    const effectiveCogs = cogs + taxAmount;

    const item = [idx + 1, penyedia, statusStok, provider, kuota, cogs];

    if (taxEnabled) {
      item.push(isRTS ? "PPN 11%" : "11,5% (PPN+PPh)", effectiveCogs);
    }

    for (let i = 0; i < 5; i++) {
      const margin = parseFloat(margins[i]) / 100;
      const baseCogs = taxEnabled ? effectiveCogs : cogs;
      const rawPrice = 1 - margin > 0 ? baseCogs / (1 - margin) : 0;
      const price = Math.round(rawPrice);
      const actualMargin = price > 0 ? (price - baseCogs) / price : 0;
      item.push(price, `${(actualMargin * 100).toFixed(1)}%`);
    }

    return item;
  });

  const summaryRow = [
    "Skenario",
    ...Array.from(
      { length: 5 },
      (_, i) => `S${i + 1}: Margin ${margins[i]}% · ${quantities[i]} unit`
    ),
  ];

  const allData = [
    headerRow1,
    headerRow2,
    [],
    summaryRow,
    [],
    columnHeaders,
    ...dataRows,
  ];

  // Ensure the sheet tab exists
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === sheetName
    );
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    }
  } catch (err) {
    console.warn("[Sheets] Could not check/create sheet tab:", err.message);
  }

  // Clear existing data
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetName}'`,
    });
  } catch {
    // Sheet might be empty, ignore
  }

  // Write all data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allData },
  });

  // Apply formatting
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetObj = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName
    );
    const sheetId = sheetObj?.properties?.sheetId;

    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, fontSize: 14 },
                  },
                },
                fields: "userEnteredFormat.textFormat",
              },
            },
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 5, endRowIndex: 6 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.9, green: 0.93, blue: 0.98 },
                  },
                },
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 6 },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: columnHeaders.length,
                },
              },
            },
          ],
        },
      });
    }
  } catch (err) {
    console.warn("[Sheets] Formatting warning:", err.message);
  }

  return {
    success: true,
    rowCount: dataRows.length,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

// ─── Pull: Google Sheets → Web ───────────────────────────────────────

/**
 * Pull product data from Google Sheets back to the web app.
 */
export async function pullFromSheets() {
  const config = await loadConfig();
  if (!config) {
    throw new Error("Google Sheets belum dikonfigurasi");
  }

  const sheets = createSheetsApi(config);
  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const allValues = response.data.values || [];

  if (allValues.length < 7) {
    return {
      rows: [],
      margins: null,
      quantities: null,
      taxEnabled: null,
      message: "Sheet kosong atau formatnya tidak sesuai",
    };
  }

  // Parse tax status from row 2 (index 1)
  const infoRow = allValues[1] || [];
  const taxText = String(infoRow[1] || "").toLowerCase();
  const taxEnabled =
    taxText.includes("aktif") && !taxText.includes("nonaktif");

  // Parse scenarios from row 4 (index 3)
  const scenarioRow = allValues[3] || [];
  const margins = [];
  const quantities = [];

  for (let i = 1; i <= 5; i++) {
    const cell = String(scenarioRow[i] || "");
    const marginMatch = cell.match(/Margin\s+([\d.]+)%/i);
    const qtyMatch = cell.match(/([\d.]+)\s*unit/i);
    margins.push(marginMatch ? marginMatch[1] : String(30 - (i - 1) * 5));
    quantities.push(qtyMatch ? qtyMatch[1] : String(100 + (i - 1) * 50));
  }

  // Parse product data from row 7+ (index 6+)
  const rows = [];
  for (let r = 6; r < allValues.length; r++) {
    const cells = allValues[r];
    if (!cells || cells.length < 5) continue;

    const no = cells[0];
    if (no === "" || no === undefined || no === null) continue;

    const penyedia = String(cells[1] || "DPT").trim();
    const statusStok = String(cells[2] || "OPEN").trim().toUpperCase();
    const provider = String(cells[3] || "").trim();
    const kuota = parseFloat(cells[4]) || 0;
    const cogs = parseFloat(cells[5]) || 0;

    const validStatus = ["OPEN", "CLOSED"].includes(statusStok)
      ? statusStok
      : "OPEN";

    rows.push([penyedia, validStatus, provider, kuota, cogs]);
  }

  return {
    rows,
    margins,
    quantities,
    taxEnabled,
    message: `Berhasil membaca ${rows.length} produk dari Google Sheets`,
  };
}

// ─── Health check ────────────────────────────────────────────────────

/**
 * Check if Google Sheets credentials are configured and connection works.
 */
export async function checkSheetsHealth() {
  try {
    const config = await loadConfig();

    if (!config) {
      return {
        configured: false,
        connected: false,
        source: null,
        error: "Credentials belum dikonfigurasi",
      };
    }

    // Try to access the spreadsheet
    const sheets = createSheetsApi(config);
    const result = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    return {
      configured: true,
      connected: true,
      source: config.source,
      spreadsheetTitle: result.data.properties.title,
      sheetNames: result.data.sheets.map((s) => s.properties.title),
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err.message,
    };
  }
}
