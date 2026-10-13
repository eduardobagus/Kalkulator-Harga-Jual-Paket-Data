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
const ALIAS = {
  0: ["penyedia produk", "penyedia"],
  1: ["stock availability", "stok", "stock"],
  2: ["provider"],
  3: ["package quota (gb)", "package quota", "kuota (gb)", "kuota", "quota"],
  4: ["cogs", "hpp", "cost"],
};

/**
 * Detect column mapping from header row.
 */
export function detectColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, i) => {
    const key = String(cell ?? "").trim().toLowerCase();
    for (const field in ALIAS) {
      if (ALIAS[field].includes(key) && map[field] === undefined) {
        map[field] = i;
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
 * Parse delimited text (CSV/TSV) with quote handling.
 */
export function parseDelimited(text) {
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
    .filter((o) => o.row.some((c) => String(c ?? "").trim() !== ""));

  if (!nonEmpty.length) {
    return { added: [], errors: ["Tidak ada data yang terbaca."] };
  }

  let colMap = detectColumnMap(nonEmpty[0].row);
  let startIndex = 1;

  // If quota or cogs column not found, assume fixed order
  if (colMap[3] === undefined || colMap[4] === undefined) {
    colMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
    startIndex = isNaN(parseNum(nonEmpty[0].row[4])) ? 1 : 0;
  }

  const added = [];
  const errors = [];

  nonEmpty.slice(startIndex).forEach((o) => {
    const r = o.row;
    const get = (f) => r[colMap[f]] ?? "";

    const stok = String(get(1)).trim().toUpperCase() || "OPEN";
    const kuota = parseNum(get(3));
    const cogs = parseNum(get(4));

    if (stok !== "OPEN" && stok !== "CLOSED") {
      errors.push(`Baris ${o.lineNum}: stok harus OPEN atau CLOSED`);
    } else if (isNaN(kuota)) {
      errors.push(`Baris ${o.lineNum}: kuota (GB) bukan angka`);
    } else if (isNaN(cogs)) {
      errors.push(`Baris ${o.lineNum}: COGS bukan angka`);
    } else {
      added.push([
        String(get(0)).trim(),
        stok,
        String(get(2)).trim(),
        kuota,
        cogs,
      ]);
    }
  });

  return { added, errors };
}
