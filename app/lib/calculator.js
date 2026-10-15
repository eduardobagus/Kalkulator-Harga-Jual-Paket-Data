// Default product data (kosong secara default, siap diisi atau diimpor)
export const DEFAULT_DATA = [];

// Indonesian number formatter (nominal Rupiah bulat tanpa desimal)
export const fmtNumber = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const fmtPercent = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Category Definitions & Metadata based on PostgreSQL check constraint:
 * CHECK (kategori IN ('IOT_M2M', 'POSTPAID', 'PREPAID', 'SPI', 'PAYU'))
 */
export const CATEGORY_DEFINITIONS = [
  {
    key: "IOT_M2M",
    label: "Monthly Charge - IoT/M2M",
    shortLabel: "IoT / M2M",
    badgeClass: "badge-cat-iot",
    color: "#0284c7",
    keywords: ["monthly charge - iot/m2m", "iot/m2m", "iot", "m2m"],
  },
  {
    key: "POSTPAID",
    label: "Monthly Charge - Postpaid",
    shortLabel: "Postpaid",
    badgeClass: "badge-cat-postpaid",
    color: "#8b5cf6",
    keywords: ["monthly charge - postpaid", "postpaid", "pascabayar"],
  },
  {
    key: "PREPAID",
    label: "Monthly Charge - Prepaid",
    shortLabel: "Prepaid",
    badgeClass: "badge-cat-prepaid",
    color: "#10b981",
    keywords: ["monthly charge - prepaid", "prepaid", "prabayar"],
  },
  {
    key: "SPI",
    label: "Simcard non Human - SPI",
    shortLabel: "SPI",
    badgeClass: "badge-cat-spi",
    color: "#f59e0b",
    keywords: ["simcard non human - spi", "non human", "spi"],
  },
  {
    key: "PAYU",
    label: "PAYU TSEL",
    shortLabel: "PAYU",
    badgeClass: "badge-cat-payu",
    color: "#ec4899",
    keywords: ["payu tsel", "payu", "tambah stock avail"],
  },
];

export function detectCategoryFromText(text) {
  const clean = String(text ?? "").toLowerCase().trim();
  if (!clean) return null;
  for (const cat of CATEGORY_DEFINITIONS) {
    if (cat.keywords.some((k) => clean.includes(k))) {
      return cat.key;
    }
  }
  return null;
}

export function getCategoryMeta(key) {
  const found = CATEGORY_DEFINITIONS.find(
    (c) => c.key === String(key ?? "").trim().toUpperCase()
  );
  if (found) return found;
  return {
    key: key || "IOT_M2M",
    label: key || "Lainnya",
    shortLabel: key || "Lainnya",
    badgeClass: "badge-cat-default",
    color: "#64748b",
  };
}

/**
 * Tax information based on Penyedia:
 * - RTS: PPN 11% (0.11)
 * - Selain RTS: PPN 11% + PPh 0.5% = 11.5% (0.115)
 */
export function getProductTaxInfo(penyedia, enabled = true) {
  if (!enabled) {
    return {
      enabled: false,
      isRTS: false,
      ppnRate: 0,
      pphRate: 0,
      totalRate: 0,
      label: "Tanpa Pajak",
      shortLabel: "0%",
      badgeClass: "badge-tax-off",
      description: "Pajak dinonaktifkan",
    };
  }

  const clean = String(penyedia ?? "").trim().toUpperCase();
  const isRTS = clean === "RTS";

  if (isRTS) {
    return {
      enabled: true,
      isRTS: true,
      ppnRate: 0.11,
      pphRate: 0,
      totalRate: 0.11,
      label: "PPN 11%",
      shortLabel: "11%",
      badgeClass: "badge-rts",
      description: "RTS: PPN 11%",
    };
  }

  return {
    enabled: true,
    isRTS: false,
    ppnRate: 0.11,
    pphRate: 0.005,
    totalRate: 0.115,
    label: "11,5% (PPN+PPh)",
    shortLabel: "11,5%",
    badgeClass: "badge-non-rts",
    description: "Selain RTS: PPN 11% + PPh 0,5% (11,5%)",
  };
}

/**
 * Calculate the selling price and actual margin in whole Rupiah (tanpa desimal).
 * Formula:
 * Tax Amount = Math.round(COGS * taxRate)
 * Effective COGS = COGS + Tax Amount
 * Price = Math.round(Effective COGS / (1 - margin))
 * Actual Margin = (Price - Effective COGS) / Price
 */
export function calculatePrice(cogs, margin, taxRate = 0) {
  const rate = typeof taxRate === "number" && !isNaN(taxRate) ? taxRate : 0;
  const taxAmount = Math.round(cogs * rate);
  const effectiveCogs = cogs + taxAmount;
  const rawPrice = 1 - margin > 0 ? effectiveCogs / (1 - margin) : 0;
  const price = Math.round(rawPrice);
  const actualMargin = price > 0 ? (price - effectiveCogs) / price : 0;
  return {
    price,
    margin: actualMargin,
    effectiveCogs,
    taxAmount,
  };
}

// Column alias map for import detection
export const ALIAS = {
  0: [
    "penyedia produk",
    "penyedia",
    "vendor",
    "supplier",
    "provider source",
    "biller",
  ],
  1: [
    "status stok",
    "status stock",
    "stock availability",
    "stok availability",
    "stok",
    "stock",
    "status",
    "availability",
  ],
  2: [
    "provider / nama paket",
    "provider/nama paket",
    "provider / paket",
    "provider / nama produk",
    "nama paket",
    "nama provider",
    "nama produk",
    "nama paket data",
    "package name",
    "provider",
    "paket",
    "produk",
    "package",
    "product",
  ],
  3: [
    "package quota (gb)",
    "package quota",
    "kuota (gb)",
    "kuota gb",
    "kuota",
    "quota (gb)",
    "quota gb",
    "quota",
    "gb",
  ],
  4: [
    "price (tp)",
    "price tp",
    "monthly quota",
    "cogs (rp)",
    "cogs rp",
    "cogs",
    "hpp (rp)",
    "hpp rp",
    "hpp",
    "modal (rp)",
    "modal rp",
    "modal",
    "cost (rp)",
    "cost",
    "harga modal",
    "cogs_rp",
  ],
  5: [
    "kategori",
    "category",
    "tipe",
    "type",
    "jenis",
    "section",
    "kategori produk",
  ],
};

function normalizeHeader(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect column mapping from header row.
 */
export function detectColumnMap(headerRow) {
  const map = {};
  if (!Array.isArray(headerRow)) return map;

  headerRow.forEach((cell, i) => {
    const raw = normalizeHeader(cell);
    if (!raw) return;

    // Do NOT match columns that explicitly indicate post-tax or markup/sell prices as base COGS
    if (
      raw.includes("after tax") ||
      raw.includes("mark up") ||
      raw.includes("sell price") ||
      raw.includes("harga jual")
    ) {
      return;
    }

    for (const field in ALIAS) {
      if (
        ALIAS[field].some(
          (alias) => raw === alias || raw.startsWith(alias) || alias.startsWith(raw)
        )
      ) {
        if (map[field] === undefined) {
          map[field] = i;
        }
      }
    }
  });

  return map;
}

/**
 * Parse a numeric value from various formats (Indonesian, English).
 */
export function parseNum(value) {
  if (typeof value === "number") return value;
  let s = String(value ?? "")
    .replace(/rp|\s/gi, "")
    .trim();
  if (!s) return NaN;
  // 36.000 → 36000 (Indonesian thousands separator)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  // 36,000 → 36000 (English thousands separator)
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  // Single comma as decimal
  else s = s.replace(",", ".");
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}

/**
 * Parse delimited text (CSV/TSV) with quote handling and UTF-8 BOM removal.
 */
export function parseDelimited(rawText) {
  // Strip UTF-8 BOM if present
  const text = String(rawText || "").replace(/^\uFEFF/, "");

  const firstLine = text.split(/\r?\n/)[0] || "";
  const delim =
    firstLine.indexOf("\t") > -1
      ? "\t"
      : firstLine.split(";").length > firstLine.split(",").length
      ? ";"
      : ",";

  const rows = [];
  let row = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === delim) {
      row.push(current);
      current = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += c;
    }
  }

  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/**
 * Process imported rows into product data.
 * Supports both multi-section spreadsheets (like Book1.xlsx with section headers)
 * and single-table flat files.
 * Returns { added: [...], errors: [...] }
 */
export function processImportRows(rows) {
  const nonEmpty = rows
    .map((r, i) => ({ row: r, lineNum: i + 1 }))
    .filter((o) => Array.isArray(o.row) && o.row.some((c) => String(c ?? "").trim() !== ""));

  if (!nonEmpty.length) {
    return { added: [], errors: ["Tidak ada data yang terbaca."] };
  }

  // Check if file contains multi-section category titles
  let hasSectionTitles = false;
  for (let idx = 0; idx < Math.min(nonEmpty.length, 50); idx++) {
    const r = nonEmpty[idx].row;
    const nonEmptyCells = r.filter((c) => String(c ?? "").trim() !== "");
    const firstCell = String(r[0] ?? "").trim();
    const joined = nonEmptyCells.join(" ");
    const cat = detectCategoryFromText(firstCell) || (nonEmptyCells.length <= 2 ? detectCategoryFromText(joined) : null);
    if (cat && nonEmptyCells.length <= 3) {
      hasSectionTitles = true;
      break;
    }
  }

  let currentCategory = "IOT_M2M";
  let currentMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
  const added = [];
  const errors = [];

  if (hasSectionTitles) {
    // === Multi-Section File Parser (e.g., Book1.xlsx with monthly charge titles) ===
    for (const o of nonEmpty) {
      const r = o.row;
      const nonEmptyCells = r.filter((c) => String(c ?? "").trim() !== "");
      const firstCell = String(r[0] ?? "").trim();
      const joinedRow = nonEmptyCells.join(" ");

      // Section title check
      const catDetected =
        detectCategoryFromText(firstCell) ||
        (nonEmptyCells.length <= 2 ? detectCategoryFromText(joinedRow) : null);
      const hasManyColumns = nonEmptyCells.length >= 4;

      if (catDetected && !hasManyColumns) {
        currentCategory = catDetected;
        continue;
      }

      // Column header check
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

      // Skip empty or non-numeric header/description rows
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
  } else {
    // === Single Table Flat File Parser ===
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
        if (countMatched >= 5) break;
      }
    }

    let colMap = bestMap;
    let startIndex = 1;

    if (maxMatched >= 3) {
      startIndex = bestHeaderIndex + 1;
    } else {
      const firstRow = nonEmpty[0].row;
      const col0IsNum = !isNaN(parseNum(firstRow[0])) && parseNum(firstRow[0]) < 1000;
      const col1IsStatusOrPenyedia = ["DPT", "RTS", "OPEN", "CLOSED"].includes(
        String(firstRow[1] || "").trim().toUpperCase()
      );

      if (col0IsNum && col1IsStatusOrPenyedia) {
        colMap = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };
      } else {
        colMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
      }
      startIndex = isNaN(parseNum(firstRow[colMap[4]])) ? 1 : 0;
    }

    nonEmpty.slice(startIndex).forEach((o) => {
      const r = o.row;
      const get = (f) => r[colMap[f]] ?? "";

      const rawStok = String(get(1)).trim().toUpperCase();
      let stok = "OPEN";
      if (rawStok === "CLOSED" || rawStok === "HABIS" || rawStok === "KOSONG") {
        stok = "CLOSED";
      }

      const kuota = parseNum(get(3));
      const cogs = parseNum(get(4));

      // Check if explicit category column is present
      const rawCat = colMap[5] !== undefined ? String(r[colMap[5]] ?? "") : "";
      const detectedCat = detectCategoryFromText(rawCat) || "IOT_M2M";

      if (isNaN(kuota)) {
        errors.push(`Baris ${o.lineNum}: kuota (GB) bukan angka`);
      } else if (isNaN(cogs)) {
        errors.push(`Baris ${o.lineNum}: COGS bukan angka`);
      } else {
        added.push([
          String(get(0)).trim() || "DPT",
          stok,
          String(get(2)).trim() || "Paket",
          kuota,
          cogs,
          null, // id
          detectedCat,
        ]);
      }
    });
  }

  return { added, errors };
}
