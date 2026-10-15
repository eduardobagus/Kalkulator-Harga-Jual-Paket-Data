import { parseNum } from "../app/lib/calculator.js";

const CATEGORY_DEFINITIONS = [
  { key: "IOT_M2M", label: "Monthly Charge - IoT/M2M", keywords: ["iot/m2m", "iot", "m2m"] },
  { key: "POSTPAID", label: "Monthly Charge - Postpaid", keywords: ["postpaid", "pascabayar"] },
  { key: "PREPAID", label: "Monthly Charge - Prepaid", keywords: ["prepaid", "prabayar"] },
  { key: "SPI", label: "Simcard non Human - SPI", keywords: ["spi", "non human"] },
  { key: "PAYU", label: "PAYU TSEL", keywords: ["payu"] },
];

function detectCategoryFromText(text) {
  const clean = String(text ?? "").toLowerCase().trim();
  if (!clean) return null;
  for (const cat of CATEGORY_DEFINITIONS) {
    if (cat.keywords.some(k => clean.includes(k))) {
      return cat.key;
    }
  }
  return null;
}

const ALIAS = {
  0: ["penyedia produk", "penyedia", "vendor", "supplier"],
  1: ["status stok", "status stock", "stock availability", "stok availability", "stok", "stock", "status", "availability"],
  2: ["provider / nama paket", "provider/nama paket", "provider / paket", "nama paket", "nama provider", "nama produk", "package name", "provider", "paket", "produk", "package"],
  3: ["package quota (gb)", "package quota", "kuota (gb)", "kuota gb", "kuota", "quota (gb)", "quota gb", "quota"],
  4: [
    "price (tp)",
    "price tp",
    "cogs (rp)",
    "cogs rp",
    "monthly quota",
    "hpp (rp)",
    "hpp rp",
    "hpp",
    "modal (rp)",
    "modal rp",
    "cogs",
    "modal",
    "cost",
  ],
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
    if (!raw) return;
    if (raw.includes("after tax") || raw.includes("mark up") || raw.includes("sell price")) {
      return;
    }
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

function processMultiSectionRows(rows) {
  const nonEmpty = rows
    .map((r, i) => ({ row: r, lineNum: i + 1 }))
    .filter((o) => Array.isArray(o.row) && o.row.some((c) => String(c ?? "").trim() !== ""));

  let currentCategory = "IOT_M2M";
  let currentMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
  const added = [];
  const errors = [];

  for (const o of nonEmpty) {
    const r = o.row;
    const nonEmptyCells = r.filter(c => String(c ?? "").trim() !== "");
    const firstCell = String(r[0] ?? "").trim();
    const joinedRow = nonEmptyCells.join(" ");

    // Check if row is a section title
    // Section titles are typically in the 1st or 2nd cell, with very few total non-empty columns (<= 3),
    // and no valid numeric price/cogs at the end
    const catDetected = detectCategoryFromText(firstCell) || (nonEmptyCells.length <= 2 ? detectCategoryFromText(joinedRow) : null);
    const hasManyColumns = nonEmptyCells.length >= 4;

    if (catDetected && !hasManyColumns) {
      currentCategory = catDetected;
      continue;
    }

    // Check if row is a column header (e.g. "Penyedia Produk", "Stock Availability", etc.)
    const detectedMap = detectColumnMap(r);
    const matchedCount = Object.keys(detectedMap).length;
    if (matchedCount >= 3) {
      currentMap = { ...detectedMap };
      continue;
    }

    // Product data row
    const get = (f) => r[currentMap[f]] ?? "";
    const rawStok = String(get(1)).trim().toUpperCase();
    let stok = "OPEN";
    if (rawStok === "CLOSED" || rawStok === "HABIS" || rawStok === "KOSONG") {
      stok = "CLOSED";
    }

    const kuota = parseNum(get(3));
    const cogs = parseNum(get(4));

    // If both kuota and cogs are NaN or empty, skip note/metadata rows
    if (isNaN(kuota) && isNaN(cogs)) {
      continue;
    }

    if (isNaN(kuota)) {
      errors.push(`Baris ${o.lineNum}: kuota (GB) bukan angka ("${get(3)}")`);
    } else if (isNaN(cogs)) {
      errors.push(`Baris ${o.lineNum}: COGS bukan angka ("${get(4)}")`);
    } else {
      const penyedia = String(get(0)).trim() || "DPT";
      const provider = String(get(2)).trim() || "Telkomsel";
      added.push([
        penyedia,
        stok,
        provider,
        kuota,
        cogs,
        null, // id
        currentCategory, // kategori
      ]);
    }
  }

  return { added, errors };
}

// Test with mockup of Book1.xlsx
const mockBook1 = [
  ["MONTHLY CHARGE - IOT/M2M"],
  ["Penyedia Produk", "Stock Availability", "Provider", "Package Quota (GB)", "COGS", "11%", "COGS AFTER TAX"],
  ["DPT", "CLOSED", "Telkomsel", "0.5", "55500"],
  ["DPT", "CLOSED", "Telkomsel", "1", "15000"],
  ["RTS", "OPEN", "Telkomsel Individual Sharing", "2", "36000"],
  [],
  ["MONTHLY CHARGE - POSTPAID"],
  ["Penyedia Produk", "Stock Availability", "Provider", "Package Quota (GB)", "COGS", "11%", "COGS AFTER TAX"],
  ["RTS", "OPEN", "Telkomsel", "0.5", "22700"],
  ["RTS", "OPEN", "Telkomsel", "1", "27750"],
  [],
  ["MONTHLY CHARGE - PREPAID"],
  ["Penyedia Produk", "Stock Availability", "Provider", "Package Quota (GB)", "SIMCARD", "11%", "COGS AFTER TAX", "MONTHLY QUOTA"],
  ["RTS", "OPEN", "Telkomsel", "0.5", "", "", "", "6550"],
  ["RTS", "OPEN", "Telkomsel", "1", "", "", "", "12000"],
  [],
  ["Simcard non Human - SPI"],
  ["Penyedia Produk", "Stock Availability", "Provider", "Package Quota (GB)", "COGS", "11%", "COGS AFTER TAX"],
  ["SPI", "OPEN", "Telkomsel - 35 days", "0.25", "4760"],
  ["SPI", "OPEN", "Telkomsel - 35 days", "0.5", "7000"],
  [],
  ["tambah stock avail, non purna | PAYU TSEL | *hanya bisa digunakan pada GPS tracking,CCTV,EDC,Soundbox"],
  ["Penyedia Produk", "Stock Availability", "Package Name", "Quota (GB)", "Validity (Days)", "Price (TP)"],
  ["SASMITA", "CLOSED", "PAYU+ M2M 0.25 GB", "0.25", "30", "9000"],
  ["SASMITA", "CLOSED", "PAYU+ M2M 0.5 GB", "0.5", "30", "12000"]
];

const res = processMultiSectionRows(mockBook1);
console.log("IMPORTED PRODUCTS COUNT:", res.added.length);
console.log("ERRORS:", res.errors);
console.log("ALL ROWS BY CATEGORY:");
res.added.forEach((p, idx) => {
  console.log(`[${idx+1}] Category: ${p[6]} | Penyedia: ${p[0]} | Provider: ${p[2]} | Kuota: ${p[3]} GB | COGS: Rp ${p[4]}`);
});
