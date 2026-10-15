import { parseNum } from "../app/lib/calculator.js";

const ALIAS = {
  0: ["penyedia produk", "penyedia", "vendor", "supplier"],
  1: ["status stok", "status stock", "stock availability", "stok availability", "stok", "stock", "status", "availability"],
  2: ["provider / nama paket", "provider/nama paket", "provider / paket", "nama paket", "nama provider", "nama produk", "provider", "paket", "produk", "package"],
  3: ["package quota (gb)", "package quota", "kuota (gb)", "kuota gb", "kuota", "quota (gb)", "quota gb", "quota"],
  4: ["cogs (rp)", "cogs rp", "cogs", "hpp (rp)", "hpp rp", "hpp", "modal (rp)", "modal rp", "modal", "cost"],
};

function normalizeHeader(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectColumnMap(headerRow) {
  const map = {};
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach((cell, i) => {
    const raw = normalizeHeader(cell);
    for (const field in ALIAS) {
      if (ALIAS[field].some(alias => raw === alias || raw.startsWith(alias) || alias.startsWith(raw))) {
        if (map[field] === undefined) {
          map[field] = i;
        }
      }
    }
  });
  return map;
}

function processImportRows(rows) {
  const nonEmpty = rows
    .map((r, i) => ({ row: r, lineNum: i + 1 }))
    .filter((o) => Array.isArray(o.row) && o.row.some((c) => String(c ?? "").trim() !== ""));

  if (!nonEmpty.length) {
    return { added: [], errors: ["Tidak ada data yang terbaca."] };
  }

  // Scan the first few rows (up to 10) to find the best header row
  let bestMap = {};
  let bestHeaderIndex = -1;
  let maxMatched = 0;

  const maxScan = Math.min(nonEmpty.length, 10);
  for (let idx = 0; idx < maxScan; idx++) {
    const candidateMap = detectColumnMap(nonEmpty[idx].row);
    const countMatched = Object.keys(candidateMap).length;
    if (countMatched > maxMatched) {
      maxMatched = countMatched;
      bestMap = candidateMap;
      bestHeaderIndex = idx;
      // If all 5 fields matched, stop scanning early
      if (countMatched >= 5) break;
    }
  }

  let colMap = bestMap;
  let startIndex = 1;

  if (maxMatched >= 3) {
    startIndex = bestHeaderIndex + 1;
  } else {
    // If no good header row found, check if first column is row number
    const firstRow = nonEmpty[0].row;
    const col0IsNum = !isNaN(parseNum(firstRow[0])) && parseNum(firstRow[0]) < 1000;
    const col1IsStatusOrPenyedia = ["DPT", "RTS", "OPEN", "CLOSED"].includes(String(firstRow[1] || "").trim().toUpperCase());

    if (col0IsNum && col1IsStatusOrPenyedia) {
      colMap = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };
    } else {
      colMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
    }
    startIndex = isNaN(parseNum(firstRow[colMap[4]])) ? 1 : 0;
  }

  const added = [];
  const errors = [];

  nonEmpty.slice(startIndex).forEach((o) => {
    const r = o.row;
    const get = (f) => r[colMap[f]] ?? "";

    const rawStok = String(get(1)).trim().toUpperCase();
    const stok = rawStok === "CLOSED" ? "CLOSED" : "OPEN";
    const kuota = parseNum(get(3));
    const cogs = parseNum(get(4));

    if (isNaN(kuota)) {
      errors.push(`Baris ${o.lineNum}: kuota (GB) bukan angka ("${get(3)}")`);
    } else if (isNaN(cogs)) {
      errors.push(`Baris ${o.lineNum}: COGS bukan angka ("${get(4)}")`);
    } else {
      added.push([
        String(get(0)).trim() || "DPT",
        stok,
        String(get(2)).trim() || "Paket",
        kuota,
        cogs,
      ]);
    }
  });

  return { added, errors };
}

// Test downloaded CSV
const csvData = [
  ["No", "Penyedia", "Status Stok", "Provider / Nama Paket", "Kuota (GB)", "COGS (Rp)", "Tarif Pajak", "Nominal Pajak (Rp)"],
  ["1", "DPT", "CLOSED", "Telkomsel Pro", "0.5", "55500", "11,5%", "6383"],
  ["2", "RTS", "OPEN", "Telkomsel Sharing", "2", "36000", "11%", "3960"]
];

console.log("TEST CSV IMPORT RESULT:", processImportRows(csvData));

// Test downloaded Excel with title headers
const excelData = [
  ["Kalkulator Harga Jual Paket Data"],
  ["Skenario 1: 100 unit | Pajak Aktif"],
  [],
  ["No", "Penyedia", "Status Stok", "Provider / Nama Paket", "Kuota (GB)", "COGS (Rp)", "Tarif Pajak"],
  ["1", "DPT", "CLOSED", "Telkomsel Pro", 0.5, 55500, "11,5%"],
  ["2", "RTS", "OPEN", "Telkomsel Sharing", 2, 36000, "11%"]
];

console.log("TEST EXCEL IMPORT RESULT:", processImportRows(excelData));
