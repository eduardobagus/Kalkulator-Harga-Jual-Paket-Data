// Default product data
export const DEFAULT_DATA = [
  ["DPT", "CLOSED", "Telkomsel", 0.5, 55500],
  ["DPT", "CLOSED", "Telkomsel", 1, 15000],
  ["RTS", "OPEN", "Telkomsel Individual Sharing", 2, 36000],
  ["RTS", "OPEN", "Telkomsel Individual Sharing", 5, 75000],
  ["DPT", "OPEN", "Telkomsel Individual Package", 3, 32500],
];

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
    "provider",
    "paket",
    "produk",
    "package",
    "package name",
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
 * Returns { added: [...], errors: [...] }
 */
export function processImportRows(rows) {
  const nonEmpty = rows
    .map((r, i) => ({ row: r, lineNum: i + 1 }))
    .filter((o) => Array.isArray(o.row) && o.row.some((c) => String(c ?? "").trim() !== ""));

  if (!nonEmpty.length) {
    return { added: [], errors: ["Tidak ada data yang terbaca."] };
  }

  // Scan the first few rows (up to 10) to find the best matching header row
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
    // If no header row found, check if first column is row numbering (e.g. 1, 2, 3...)
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

  const added = [];
  const errors = [];

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
      ]);
    }
  });

  return { added, errors };
}
