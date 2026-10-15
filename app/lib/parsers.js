/**
 * Flexible number, percentage, and range parsers for Indonesian & International spreadsheet formats.
 */

// Detect and clean formula errors or placeholders
export function isInvalidOrFormulaError(val) {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  return (
    s === "#REF!" ||
    s === "#VALUE!" ||
    s === "#N/A" ||
    s === "#NAME?" ||
    s === "#DIV/0!" ||
    s.startsWith("ERR:") ||
    s === "NULL" ||
    s === "UNDEFINED" ||
    s === "NAN"
  );
}

// Parses Indonesian (1.600.000 or 1.600.000,50) and English (1,600,000 or 1600000.50) numbers
export function parseNumberFlexible(val, fallback = null) {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  if (isInvalidOrFormulaError(val)) return fallback;

  let str = String(val).trim();
  // Strip Currency prefixes (Rp, IDR, $, etc.) and spaces
  str = str.replace(/^(Rp\.?|IDR|\$)\s*/i, "").trim();

  // If empty after stripping
  if (!str) return fallback;

  // Handle Indonesian thousand separator (dots) with decimal comma: "1.600.000,50" -> "1600000.50"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  // Handle English thousand separator (commas) with decimal dot: "1,600,000.50" -> "1600000.50"
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, "");
  }
  // Handle simple decimal comma without thousand dot: "15,5" -> "15.5"
  else if (/^\d+(,\d+)$/.test(str)) {
    str = str.replace(",", ".");
  }
  // Plain numbers with thousand dots: "1.600.000" -> "1600000"
  else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }
  // Clean any remaining non-numeric except dot, minus
  else {
    str = str.replace(/[^0-9.-]/g, "");
  }

  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

// Parses percentage: "45%", "0.45", "45", "45,5%" -> 45
export function parsePercentFlexible(val, fallback = 0) {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") {
    // If entered as 0.45 in excel format, convert to 45
    if (val > 0 && val < 1) return val * 100;
    return val;
  }
  if (isInvalidOrFormulaError(val)) return fallback;

  let str = String(val).trim();
  const hasPercentSign = str.includes("%");
  str = str.replace(/%/g, "").trim().replace(",", ".");

  const num = parseFloat(str);
  if (isNaN(num)) return fallback;

  // If decimal was typed without percent sign (e.g. 0.3), treat as 30%
  if (!hasPercentSign && num > 0 && num < 1) {
    return num * 100;
  }
  return num;
}

// Parses quantity range: "1-9 unit", "1–200", "1 - 9", "100" -> { min: 1, max: 9, label: "1–9 unit" }
export function parseRangeFlexible(val, defaultMin = 1, defaultMax = 1) {
  if (val === null || val === undefined || val === "") {
    return { min: defaultMin, max: defaultMax, label: `${defaultMin}–${defaultMax}` };
  }
  const str = String(val).trim();
  // Strip words like "unit", "pcs", etc.
  const cleaned = str.replace(/[a-zA-Z]/g, "").trim();
  const match = cleaned.match(/(\d+)\s*[-–—~]\s*(\d+)/);
  if (match) {
    const min = parseInt(match[1], 10) || defaultMin;
    const max = parseInt(match[2], 10) || defaultMax;
    return { min, max, label: `${min}–${max}` };
  }
  const single = parseInt(cleaned, 10);
  if (!isNaN(single)) {
    return { min: single, max: single, label: `${single}` };
  }
  return { min: defaultMin, max: defaultMax, label: str };
}

// Universal CSV Delimiter detector (comma vs semicolon vs tab)
export function parseDelimitedFlexible(text) {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Count delimiters on first few lines
  const sample = lines.slice(0, 5).join("\n");
  const countComma = (sample.match(/,/g) || []).length;
  const countSemicolon = (sample.match(/;/g) || []).length;
  const countTab = (sample.match(/\t/g) || []).length;

  let delimiter = ",";
  if (countTab > countComma && countTab > countSemicolon) delimiter = "\t";
  else if (countSemicolon > countComma) delimiter = ";";

  // Parse lines considering quotes
  return lines.map((line) => {
    const row = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific Domain Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. EDC Referral Parser
 * Expected columns: Spec Type, Tier Qty, Selling Price, Referral Fee %, Simulasi Qty, Kategori (optional)
 */
export function parseEdcRows(rawRows) {
  const added = [];
  const errors = [];

  rawRows.forEach((cols, idx) => {
    if (!cols || cols.length === 0) return;
    const lineNum = idx + 1;

    // Filter out header rows
    const firstCell = String(cols[0] || "").toLowerCase().trim();
    if (
      firstCell === "no" ||
      firstCell === "spec type" ||
      firstCell === "kategori" ||
      firstCell === "tipe" ||
      firstCell.includes("referral fee") ||
      firstCell.includes("one time charge") ||
      firstCell.includes("monthly rent")
    ) {
      return;
    }

    // Try finding columns dynamically or by index
    // Typical pattern: [No, Spec Type, Tier Qty, Selling Price, Referral Fee %, Referral Fee per Unit, Simulasi Qty, Total]
    // Or without No: [Spec Type, Tier Qty, Selling Price, Referral Fee %, ...]
    let specType = "";
    let tierRange = "1–200";
    let sellingPrice = 0;
    let feePct = 5;
    let simQty = 200;
    let kategori = "EDC — One Time Charge";
    let tipeTransaksi = "ONE_TIME";

    // Shift if first column is sequence number "1", "2"
    let offset = 0;
    if (/^\d+$/.test(String(cols[0]).trim()) && cols.length > 4) {
      offset = 1;
    }

    specType = String(cols[offset] || "").trim();
    if (!specType) {
      // If empty row, skip
      return;
    }

    const rangeObj = parseRangeFlexible(cols[offset + 1], 1, 200);
    tierRange = rangeObj.label;

    sellingPrice = parseNumberFlexible(cols[offset + 2], 0);
    feePct = parsePercentFlexible(cols[offset + 3], 5);
    simQty = parseInt(parseNumberFlexible(cols[offset + 5] || cols[offset + 4], 200), 10) || 200;

    // Detect Monthly Rent vs One Time
    const combinedStr = (specType + " " + (cols[offset + 6] || "")).toLowerCase();
    if (
      combinedStr.includes("rent") ||
      combinedStr.includes("sewa") ||
      combinedStr.includes("monthly") ||
      sellingPrice < 1000000 // Typically rent is ~250k vs purchase ~2.8m
    ) {
      kategori = "EDC — Rent (Monthly Charge)";
      tipeTransaksi = "MONTHLY_RENT";
    }

    const feePerUnit = Math.round(sellingPrice * (feePct / 100));
    const totalFee = feePerUnit * simQty;

    added.push({
      kategori,
      tipe_transaksi: tipeTransaksi,
      spec_type: specType,
      tier_min_qty: rangeObj.min,
      tier_max_qty: rangeObj.max,
      selling_price: sellingPrice,
      referral_fee_pct: feePct,
      referral_fee_per_unit: feePerUnit,
      simulation_qty: simQty,
      total_referral_fee: totalFee,
      remarks: cols[offset + 7] ? String(cols[offset + 7]).trim() : "",
    });
  });

  return { added, errors };
}

/**
 * 2. Router Parser
 * Expected columns: Nama Produk, Jenis Transaksi, Jangka Waktu, Qty (Min-Max), COGS CKU, COGS RTS, Margin %, Remarks
 */
export function parseRouterRows(rawRows) {
  const added = [];
  const errors = [];

  rawRows.forEach((cols, idx) => {
    if (!cols || cols.length === 0) return;
    const lineNum = idx + 1;

    const firstCell = String(cols[0] || "").toLowerCase().trim();
    if (
      firstCell === "no" ||
      firstCell === "id" ||
      firstCell === "nama produk" ||
      firstCell === "produk" ||
      firstCell.includes("beli putus") ||
      firstCell.includes("sewa") ||
      firstCell.includes("aksesoris")
    ) {
      return;
    }

    let offset = 0;
    if (/^\d+$/.test(String(cols[0]).trim()) && cols.length > 5) {
      offset = 1;
    }

    const namaProduk = String(cols[offset] || "").trim();
    if (!namaProduk) return;

    let jenisTransaksi = String(cols[offset + 1] || "Beli Putus").trim();
    if (/sewa/i.test(namaProduk) || /sewa/i.test(jenisTransaksi)) jenisTransaksi = "Sewa";
    else if (/antena|adaptor|aksesoris/i.test(namaProduk) || /aksesoris/i.test(jenisTransaksi)) jenisTransaksi = "Aksesoris";
    else jenisTransaksi = "Beli Putus";

    // Jangka waktu sewa (e.g. 12 bulan)
    let jangkaWaktu = null;
    if (jenisTransaksi === "Sewa") {
      const jwMatch = String(cols[offset + 2] || namaProduk).match(/(\d+)\s*(bulan|month)?/i);
      jangkaWaktu = jwMatch ? parseInt(jwMatch[1], 10) : 12;
    }

    const rangeObj = parseRangeFlexible(cols[offset + 3] || cols[offset + 2], 1, 9);
    const cogsCku = parseNumberFlexible(cols[offset + 4], null);
    const cogsRts = parseNumberFlexible(cols[offset + 5], null);
    const marginPct = parsePercentFlexible(cols[offset + 6], 45);

    // Calculate Selling Price using Margin formula: COGS RTS / (1 - Margin) rounded to round thousand
    let sellingPrice = null;
    let grossProfit = null;
    if (cogsRts !== null && cogsRts > 0 && marginPct < 100) {
      const rawPrice = cogsRts / (1 - marginPct / 100);
      // Round up to nearest 5.000 or 10.000 (Excel convention for router)
      sellingPrice = Math.round(rawPrice / 5000) * 5000;
      grossProfit = sellingPrice - cogsRts;
    }

    added.push({
      kategori: jenisTransaksi,
      nama_produk: namaProduk,
      jenis_transaksi: jenisTransaksi,
      jangka_waktu_sewa: jangkaWaktu,
      min_qty: rangeObj.min,
      max_qty: rangeObj.max,
      cogs_cku: cogsCku,
      cogs_rts: cogsRts,
      margin_pct: marginPct,
      selling_price: sellingPrice,
      gross_profit: grossProfit,
      remarks: cols[offset + 7] ? String(cols[offset + 7]).trim() : "",
    });
  });

  return { added, errors };
}

/**
 * 3. Cloudsim Parser
 * Expected columns: Tipe Cloudsim, Provider, Negara, Quota (GB), Licence Fee, Simbank, Quota Price, Margin %, Bottom Line %
 */
export function parseCloudsimRows(rawRows) {
  const added = [];
  const errors = [];

  rawRows.forEach((cols, idx) => {
    if (!cols || cols.length === 0) return;
    const firstCell = String(cols[0] || "").toLowerCase().trim();
    if (
      firstCell === "no" ||
      firstCell === "id" ||
      firstCell.includes("tipe") ||
      firstCell.includes("monthly charge") ||
      firstCell.includes("package quota")
    ) {
      return;
    }

    let offset = 0;
    if (/^\d+$/.test(String(cols[0]).trim()) && cols.length > 5) {
      offset = 1;
    }

    const tipeCloudsim = String(cols[offset] || "").trim();
    if (!tipeCloudsim) return;

    let jmlProvider = parseInt(cols[offset + 1], 10);
    if (isNaN(jmlProvider)) {
      const pMatch = tipeCloudsim.match(/(\d+)\s*provider/i);
      jmlProvider = pMatch ? parseInt(pMatch[1], 10) : 1;
    }

    let negara = String(cols[offset + 2] || "Domestik").trim();
    if (/roaming|malaysia|singapore/i.test(tipeCloudsim) || /roaming/i.test(negara)) {
      if (negara.toLowerCase() === "domestik") negara = "Malaysia";
    }

    const quotaGb = parseNumberFlexible(cols[offset + 3], 1);
    const licenceFee = parseNumberFlexible(cols[offset + 4], null);
    const simbank = parseNumberFlexible(cols[offset + 5], null);
    const quotaPrice = parseNumberFlexible(cols[offset + 6], null);
    const marginPct = parsePercentFlexible(cols[offset + 7], 30);
    const bottomLinePct = parsePercentFlexible(cols[offset + 8], 20);

    // Compute COGS = licenceFee + (simbank || 0) + quotaPrice
    let cogs = null;
    let sellingPrice = null;
    let status = "Lengkap";

    if (licenceFee !== null && quotaPrice !== null) {
      cogs = (licenceFee || 0) + (simbank || 0) + (quotaPrice || 0);
      if (marginPct < 100) {
        sellingPrice = Math.round(cogs / (1 - marginPct / 100));
      }
    } else {
      status = "Belum Lengkap";
    }

    added.push({
      kategori: tipeCloudsim,
      tipe_cloudsim: tipeCloudsim,
      jumlah_provider: jmlProvider,
      negara,
      package_quota_gb: quotaGb,
      licence_fee: licenceFee,
      simbank,
      quota_price: quotaPrice,
      cogs,
      margin_pct: marginPct,
      bottom_line_pct: bottomLinePct,
      selling_price: sellingPrice,
      status_kelengkapan: status,
      remarks: cols[offset + 9] ? String(cols[offset + 9]).trim() : "",
    });
  });

  return { added, errors };
}

/**
 * 4. Logistik Parser
 * Columns: origin_city_code, origin_city, destination_city_code, destination_city, service_type, product_name, start_weight, end_weight, rate_type, range_type, publish_rate, markup_percentage
 */
export function parseLogistikRows(rawRows) {
  const added = [];
  const errors = [];

  rawRows.forEach((cols, idx) => {
    if (!cols || cols.length === 0) return;
    const firstCell = String(cols[0] || "").toLowerCase().trim();
    if (
      firstCell === "no" ||
      firstCell === "origin" ||
      firstCell.includes("origin_city") ||
      firstCell.includes("city_code")
    ) {
      return;
    }

    let offset = 0;
    if (/^\d+$/.test(String(cols[0]).trim()) && cols.length > 7) {
      offset = 1;
    }

    const originCode = String(cols[offset] || "").trim().toUpperCase();
    const originCity = String(cols[offset + 1] || originCode).trim().toUpperCase();
    const destCode = String(cols[offset + 2] || "").trim().toUpperCase();
    const destCity = String(cols[offset + 3] || destCode).trim().toUpperCase();

    if (!originCode || !destCode) return;

    const serviceType = String(cols[offset + 4] || "package").trim().toLowerCase();
    const productName = String(cols[offset + 5] || "REGPACK").trim().toUpperCase();
    const startWeight = parseNumberFlexible(cols[offset + 6], 1);
    const endWeight = parseNumberFlexible(cols[offset + 7], 1000);
    const rateType = String(cols[offset + 8] || "per_kg").trim().toLowerCase();
    const rangeType = String(cols[offset + 9] || "CHARGEABLE_weight").trim();
    const publishRate = parseNumberFlexible(cols[offset + 10], null);
    const markupPct = parsePercentFlexible(cols[offset + 11], 40);

    let sellingRate = null;
    if (publishRate !== null && publishRate > 0) {
      sellingRate = Math.round(publishRate * (1 + markupPct / 100));
    }

    added.push({
      kategori: productName,
      origin_city_code: originCode,
      origin_city: originCity,
      destination_city_code: destCode,
      destination_city: destCity,
      service_type: serviceType,
      product_name: productName,
      start_weight: startWeight,
      end_weight: endWeight,
      rate_type: rateType,
      range_type: rangeType,
      publish_rate: publishRate,
      markup_percentage: markupPct,
      selling_rate: sellingRate,
      remarks: cols[offset + 12] ? String(cols[offset + 12]).trim() : "",
    });
  });

  return { added, errors };
}

/**
 * 5. Simcard Parser
 * Columns: [Penyedia, Status Stok, Provider, Kuota (GB), COGS, (optional Kategori)]
 */
export function parseSimcardRows(rawRows) {
  const added = [];
  const errors = [];

  rawRows.forEach((cols, idx) => {
    if (!cols || cols.length === 0) return;
    const first = String(cols[0] || "").toLowerCase().trim();
    if (first === "penyedia" || first.includes("penyedia produk") || first === "provider") {
      return;
    }

    let penyedia = String(cols[0] || "DPT").trim().toUpperCase();
    if (!penyedia) penyedia = "DPT";

    let statusStok = String(cols[1] || "OPEN").trim().toUpperCase();
    if (statusStok !== "OPEN" && statusStok !== "CLOSED") {
      statusStok = "OPEN";
    }

    const provider = String(cols[2] || "").trim();
    if (!provider) return;

    const kuota = parseNumberFlexible(cols[3], null);
    if (kuota === null || isNaN(kuota)) {
      errors.push(`Baris ${idx + 1}: Kuota (${cols[3]}) bukan angka valid`);
      return;
    }

    const cogs = parseNumberFlexible(cols[4], 0);
    const kategori = cols[5] ? String(cols[5]).trim() : "";

    added.push([penyedia, statusStok, provider, kuota, cogs, null, kategori]);
  });

  return { added, errors };
}

