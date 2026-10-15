"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  calculatePrice,
  getProductTaxInfo,
  fmtNumber,
  fmtPercent,
  getCategoryMeta,
} from "../lib/calculator";
import { PRODUCT_TYPES, getProductTypeConfig } from "../lib/productTypes";

const NUM_SCENARIOS = 5;

// Color palette for scenario headers
const SCENARIO_COLORS = [
  { class: "group-header-s1", color: "var(--accent-light)", border: "var(--accent)" },
  { class: "group-header-s2", color: "#38bdf8", border: "#38bdf8" },
  { class: "group-header-s3", color: "#a78bfa", border: "#a78bfa" },
  { class: "group-header-s4", color: "#fb923c", border: "#fb923c" },
  { class: "group-header-s5", color: "#f472b6", border: "#f472b6" },
];

function MarginBadge({ actual, target }) {
  if (isNaN(actual)) return <span>-</span>;
  const isLow = Math.round(actual * 1000) < Math.round(target * 1000);
  return (
    <span className={`badge ${isLow ? "badge-warning" : "badge-success"}`}>
      {fmtPercent.format(actual * 100)}%
    </span>
  );
}

function ProductRow({
  row,
  index,
  onUpdate,
  onDelete,
  taxEnabled,
  availableCategories = [],
  onAddCustomCategory,
}) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(row[6] || "");

  const handleChange = (field, value) => {
    onUpdate(index, field, value);
  };

  const handleCategorySelectChange = (e) => {
    const val = e.target.value;
    if (val === "__NEW__") {
      setIsCustomMode(true);
      setCustomVal("");
    } else {
      handleChange(6, val);
    }
  };

  const handleCustomCategoryCommit = () => {
    const trimmed = customVal.trim();
    if (trimmed) {
      if (onAddCustomCategory) onAddCustomCategory(trimmed);
      handleChange(6, trimmed);
    } else {
      handleChange(6, "");
    }
    setIsCustomMode(false);
  };

  const catMeta = getCategoryMeta(row[6]);
  const currentCategory = row[6] || "";

  return (
    <tr className="tbl-row">
      {/* Category selector column */}
      <td className="col-kategori">
        {isCustomMode ? (
          <div className="cat-inline-edit">
            <input
              type="text"
              className="tbl-input font-semibold"
              placeholder="Ketik kategori..."
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomCategoryCommit();
                if (e.key === "Escape") setIsCustomMode(false);
              }}
              onBlur={handleCustomCategoryCommit}
              autoFocus
            />
          </div>
        ) : (
          <select
            value={currentCategory}
            onChange={handleCategorySelectChange}
            className="tbl-select-cat font-semibold"
            aria-label="Kategori"
            title={`Kategori: ${catMeta?.label || currentCategory || "(Opsional / Kosong)"}`}
          >
            <option value="">(Opsional / Kosong)</option>
            {availableCategories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.shortLabel || cat.label}
              </option>
            ))}
            {currentCategory &&
              !availableCategories.some(
                (c) => c.key.toLowerCase() === currentCategory.toLowerCase()
              ) && (
                <option value={currentCategory}>{currentCategory}</option>
              )}
            <option value="__NEW__">+ Ketik Kategori Baru...</option>
          </select>
        )}
      </td>

      <td className="col-penyedia">
        <input
          className="tbl-input text-center font-semibold"
          value={row[0] ?? ""}
          onChange={(e) => handleChange(0, e.target.value)}
          placeholder="Penyedia"
          aria-label="Penyedia"
        />
      </td>

      <td className="col-stok">
        <select
          value={row[1] ?? "OPEN"}
          onChange={(e) => handleChange(1, e.target.value)}
          className={`tbl-select ${
            row[1] === "OPEN" ? "stok-open" : "stok-closed"
          }`}
          aria-label="Stok"
        >
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      </td>

      <td className="col-provider">
        <input
          className="tbl-input"
          value={row[2] ?? ""}
          onChange={(e) => handleChange(2, e.target.value)}
          placeholder="Nama provider / paket"
          aria-label="Provider"
        />
      </td>

      <td className="col-kuota">
        <input
          type="number"
          className="tbl-input text-right font-mono"
          value={row[3] === "" || row[3] === undefined || isNaN(row[3]) ? "" : row[3]}
          onChange={(e) => {
            const val = e.target.value;
            handleChange(3, val === "" ? "" : isNaN(parseFloat(val)) ? "" : parseFloat(val));
          }}
          min="0"
          step="0.5"
          aria-label="Kuota GB"
        />
      </td>

      <td className="col-cogs">
        <input
          type="number"
          className="tbl-input text-right font-mono"
          value={row[4] === "" || row[4] === undefined || isNaN(row[4]) ? "" : row[4]}
          onChange={(e) => {
            const val = e.target.value;
            handleChange(4, val === "" ? "" : isNaN(parseFloat(val)) ? "" : parseFloat(val));
          }}
          min="0"
          step="500"
          aria-label="COGS"
        />
      </td>

      {/* Tax info & effective COGS when tax enabled */}
      {taxEnabled && (
        <>
          <td className="col-tax text-center">
            <span
              className={`badge badge-tax ${row._taxInfo?.badgeClass || ""}`}
              title={row._taxInfo?.description}
            >
              {row._taxInfo?.label}
            </span>
          </td>
          <td className="col-cogs-tax text-right">
            {row._effectiveCogs !== undefined && !isNaN(row._effectiveCogs) ? (
              <div className="effective-cogs-box">
                <span className="effective-cogs-val">
                  Rp {fmtNumber.format(row._effectiveCogs)}
                </span>
                {row._taxAmount > 0 && (
                  <span className="effective-cogs-diff">
                    (+Rp {fmtNumber.format(row._taxAmount)})
                  </span>
                )}
              </div>
            ) : (
              "-"
            )}
          </td>
        </>
      )}

      {/* Results for all 5 scenarios */}
      {Array.from({ length: NUM_SCENARIOS }, (_, i) => (
        <React.Fragment key={i}>
          <td className="col-price cell-price">{row[`_p${i}`] ?? "-"}</td>
          <td className="col-margin cell-margin">
            {row[`_m${i}`] !== undefined ? (
              <MarginBadge actual={row[`_m${i}`]} target={row[`_targetMargin${i}`]} />
            ) : (
              "-"
            )}
          </td>
        </React.Fragment>
      ))}

      <td className="col-action text-center">
        <button
          className="tbl-btn-del"
          onClick={() => onDelete(index)}
          title="Hapus baris"
          aria-label="Hapus baris"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function ProductTable({
  data,
  onUpdate,
  onDelete,
  onAdd,
  onReset,
  margins,
  quantities,
  error,
  taxEnabled = true,
  productType = "simcard",
  onChangeProductType,
  typeCounts = {},
  children,
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [customCategories, setCustomCategories] = useState([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const typeConfig = useMemo(() => getProductTypeConfig(productType), [productType]);

  // Available categories for this product type, plus any extra found in data or added by user
  const availableCategories = useMemo(() => {
    const list = [...(typeConfig.categories || [])];
    const existingKeys = new Set(list.map((c) => c.key.toLowerCase()));

    // From data rows
    data.forEach((r) => {
      const k = (r[6] || "").trim();
      if (k && !existingKeys.has(k.toLowerCase())) {
        list.push({
          key: k,
          label: k,
          shortLabel: k,
          badgeClass: "badge-cat-default",
          color: "#64748b",
        });
        existingKeys.add(k.toLowerCase());
      }
    });

    // Custom categories added in current session
    customCategories.forEach((k) => {
      const trimmed = (k || "").trim();
      if (trimmed && !existingKeys.has(trimmed.toLowerCase())) {
        list.push({
          key: trimmed,
          label: trimmed,
          shortLabel: trimmed,
          badgeClass: "badge-cat-default",
          color: "#0284c7",
        });
        existingKeys.add(trimmed.toLowerCase());
      }
    });

    return list;
  }, [typeConfig, data, customCategories]);

  // Handler to register a custom category
  const handleAddCustomCategory = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    setCustomCategories((prev) => {
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
  }, []);

  const handleSaveNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed) {
      handleAddCustomCategory(trimmed);
      setSelectedCategory(trimmed);
      setCurrentPage(1);
    }
    setNewCategoryName("");
    setShowNewCategoryInput(false);
  };

  // Reset category filter when switching product type
  useEffect(() => {
    setSelectedCategory("ALL");
    setSearchTerm("");
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setCurrentPage(1);
  }, [productType]);

  const parsedMargins = useMemo(
    () => margins.map((m) => parseFloat(m) / 100),
    [margins]
  );

  // Enriched full dataset
  const enrichedData = useMemo(() => {
    return data.map((row, originalIndex) => {
      const rawCogs = row[4];
      const cogs = typeof rawCogs === "number" ? rawCogs : parseFloat(rawCogs);
      const enriched = [...row];
      enriched._originalIndex = originalIndex;

      const categoryKey = row[6] || "";
      enriched._categoryKey = categoryKey;
      enriched._categoryMeta = getCategoryMeta(categoryKey);

      const taxInfo = getProductTaxInfo(row[0], taxEnabled);
      enriched._taxInfo = taxInfo;

      for (let i = 0; i < NUM_SCENARIOS; i++) {
        enriched[`_targetMargin${i}`] = parsedMargins[i];

        if (!error && !isNaN(cogs) && cogs >= 0 && rawCogs !== "") {
          const result = calculatePrice(cogs, parsedMargins[i], taxInfo.totalRate);
          enriched[`_p${i}`] = `Rp ${fmtNumber.format(result.price)}`;
          enriched[`_rawPrice${i}`] = result.price;
          enriched[`_m${i}`] = result.margin;
          if (i === 0) {
            enriched._effectiveCogs = result.effectiveCogs;
            enriched._taxAmount = result.taxAmount;
          }
        } else {
          enriched[`_p${i}`] = "-";
          enriched[`_rawPrice${i}`] = 0;
          enriched[`_m${i}`] = undefined;
          if (i === 0) {
            enriched._effectiveCogs = undefined;
            enriched._taxAmount = undefined;
          }
        }
      }

      return enriched;
    });
  }, [data, parsedMargins, error, taxEnabled, typeConfig]);

  // Dynamic category counts from data
  const categoryCounts = useMemo(() => {
    const counts = { ALL: data.length, NONE: 0 };
    availableCategories.forEach((cat) => {
      counts[cat.key] = 0;
    });
    data.forEach((row) => {
      const cat = (row[6] || "").trim();
      if (!cat) {
        counts.NONE = (counts.NONE || 0) + 1;
      } else {
        const matched = availableCategories.find(
          (c) => c.key.toLowerCase() === cat.toLowerCase()
        );
        const key = matched ? matched.key : cat;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [data, availableCategories]);

  // Filtered dataset based on active category & search
  const filteredData = useMemo(() => {
    return enrichedData.filter((row) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        const rowCat = (row[6] || "").trim();
        if (selectedCategory === "NONE") {
          if (rowCat !== "") return false;
        } else {
          if (rowCat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const penyedia = String(row[0] || "").toLowerCase();
        const provider = String(row[2] || "").toLowerCase();
        const catLabel = (row._categoryMeta?.label || row[6] || "").toLowerCase();
        if (
          !penyedia.includes(term) &&
          !provider.includes(term) &&
          !catLabel.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedData, selectedCategory, searchTerm]);

  const qtyLabels = useMemo(
    () =>
      quantities.map((q) =>
        isNaN(parseFloat(q)) ? "-" : fmtNumber.format(parseFloat(q))
      ),
    [quantities]
  );

  // Pagination state (default: 10 baris per halaman)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalFilteredRows = filteredData.length;
  const isAll = pageSize === "all";
  const effectivePageSize = isAll ? totalFilteredRows : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalFilteredRows / effectivePageSize));

  // Reset page when out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const startIndex = isAll ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalFilteredRows : Math.min(startIndex + effectivePageSize, totalFilteredRows);
  const displayedRows = filteredData.slice(startIndex, endIndex);

  // Helper when adding product so user lands on the new row's page
  const handleAddProduct = () => {
    const targetCat = selectedCategory === "ALL" || selectedCategory === "NONE" ? "" : selectedCategory;
    onAdd(targetCat);
    if (!isAll) {
      const newTotal = totalFilteredRows + 1;
      const targetPage = Math.ceil(newTotal / effectivePageSize);
      setCurrentPage(targetPage);
    }
  };

  // Generate page numbers array with ellipses
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  }, [currentPage, totalPages]);

  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadExcel = async () => {
    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const headerRow = [
        "No",
        "Kategori",
        "Penyedia",
        "Status Stok",
        "Provider / Nama Paket",
        "Kuota (GB)",
        "COGS (Rp)",
      ];

      if (taxEnabled) {
        headerRow.push("Tarif Pajak", "Nominal Pajak (Rp)", "COGS + Pajak (Rp)");
      }

      for (let i = 0; i < NUM_SCENARIOS; i++) {
        headerRow.push(
          `Harga Jual (${qtyLabels[i]} unit - Margin ${margins[i]}%)`,
          `Margin Aktual (${qtyLabels[i]} unit)`
        );
      }

      const rowsToExport = filteredData.length > 0 ? filteredData : enrichedData;

      const dataRows = rowsToExport.map((row, idx) => {
        const item = [
          idx + 1,
          row._categoryMeta?.label || row[6] || typeConfig.defaultKategori,
          row[0] || "-",
          row[1] || "-",
          row[2] || "-",
          typeof row[3] === "number" ? row[3] : Number(row[3]) || 0,
          typeof row[4] === "number" ? row[4] : Number(row[4]) || 0,
        ];

        if (taxEnabled) {
          item.push(
            row._taxInfo?.label || "0%",
            row._taxAmount ? Math.round(row._taxAmount) : 0,
            row._effectiveCogs ? Math.round(row._effectiveCogs) : (Number(row[4]) || 0)
          );
        }

        for (let i = 0; i < NUM_SCENARIOS; i++) {
          const pVal = typeof row[`_rawPrice${i}`] === "number" ? Math.round(row[`_rawPrice${i}`]) : 0;
          const mPct = row[`_m${i}`] !== undefined && !isNaN(row[`_m${i}`]) ? `${(row[`_m${i}`] * 100).toFixed(1)}%` : "-";
          item.push(pVal, mPct);
        }

        return item;
      });

      const scenarioSummary = margins.map(
        (m, i) => `Skenario ${i + 1}: ${qtyLabels[i]} unit (Margin ${m}%)`
      ).join("  |  ");

      const ws = XLSX.utils.aoa_to_sheet([
        [`Kalkulator Harga Jual — ${typeConfig.label}`],
        [
          scenarioSummary,
          `Pajak: ${taxEnabled ? "Aktif" : "Nonaktif"}`,
          `Sistem: Nominal Rupiah bulat tanpa desimal`,
        ],
        [],
        headerRow,
        ...dataRows,
      ]);

      ws["!cols"] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 34 },
        { wch: 14 },
        { wch: 16 },
        ...(taxEnabled ? [{ wch: 18 }, { wch: 18 }, { wch: 18 }] : []),
        ...Array.from({ length: NUM_SCENARIOS }, () => [{ wch: 24 }, { wch: 16 }]).flat(),
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, typeConfig.label);

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Harga_Jual_${typeConfig.label.replace(/\s+/g, "_")}_${today}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");

      const headerRow = [
        "No",
        "Kategori",
        "Penyedia",
        "Status Stok",
        "Provider / Nama Paket",
        "Kuota (GB)",
        "COGS (Rp)",
      ];

      if (taxEnabled) {
        headerRow.push("Tarif Pajak", "Nominal Pajak (Rp)", "COGS + Pajak (Rp)");
      }

      for (let i = 0; i < NUM_SCENARIOS; i++) {
        headerRow.push(
          `Harga Jual (${qtyLabels[i]} unit - Margin ${margins[i]}%)`,
          `Margin Aktual (${qtyLabels[i]} unit)`
        );
      }

      const rowsToExport = filteredData.length > 0 ? filteredData : enrichedData;

      const dataRows = rowsToExport.map((row, idx) => {
        const item = [
          idx + 1,
          row._categoryMeta?.label || row[6] || typeConfig.defaultKategori,
          row[0] || "-",
          row[1] || "-",
          row[2] || "-",
          row[3] || 0,
          row[4] || 0,
        ];

        if (taxEnabled) {
          item.push(
            row._taxInfo?.label || "0%",
            row._taxAmount ? Math.round(row._taxAmount) : 0,
            row._effectiveCogs ? Math.round(row._effectiveCogs) : (Number(row[4]) || 0)
          );
        }

        for (let i = 0; i < NUM_SCENARIOS; i++) {
          const pVal = typeof row[`_rawPrice${i}`] === "number" ? Math.round(row[`_rawPrice${i}`]) : 0;
          const mPct = row[`_m${i}`] !== undefined && !isNaN(row[`_m${i}`]) ? `${(row[`_m${i}`] * 100).toFixed(1)}%` : "-";
          item.push(pVal, mPct);
        }

        return item;
      });

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Harga_Jual_${typeConfig.label.replace(/\s+/g, "_")}_${today}.csv`, { bookType: "csv" });
    } catch (err) {
      console.error("Gagal export CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Base columns count: Kategori(1) + Penyedia(1) + Stok(1) + Provider(1) + Kuota(1) + COGS(1) + [Tax(2)]
  const baseColCount = taxEnabled ? 8 : 6;

  return (
    <section className="card card-delay-2">
      <div className="table-header-flex">
        <div className="product-title-group">
          <h2 className="card-title product-title-main">
            <span className="product-title-text">Produk</span>
            <div className="product-title-select-wrap">
              <select
                id="productTypeHeaderSelect"
                className="product-title-select"
                value={productType}
                onChange={(e) => onChangeProductType && onChangeProductType(e.target.value)}
                aria-label="Pilih Jenis Produk"
              >
                {PRODUCT_TYPES.map((type) => {
                  const count = typeCounts[type.id] ?? 0;
                  return (
                    <option key={type.id} value={type.id}>
                      {type.label} ({count} produk)
                    </option>
                  );
                })}
              </select>
            </div>
            <span className="counter-badge">
              {filteredData.length !== data.length
                ? `${filteredData.length} dari ${data.length} produk`
                : `${data.length} produk`}
            </span>
          </h2>
        </div>

        {typeConfig?.description && (
          <span className="product-header-hint">
            {typeConfig.description}
          </span>
        )}
      </div>

      {/* Dynamic Category Filter Bar (Dropdown & Optional Add Category) */}
      <div className="category-filter-wrapper">
        <div className="category-filter-top">
          <div className="category-filter-left">
            <label htmlFor="categoryFilterSelect" className="category-filter-label">
              Kategori:
            </label>
            <div className="category-select-wrapper">
              <select
                id="categoryFilterSelect"
                className="category-filter-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter berdasarkan kategori"
              >
                <option value="ALL">Semua Kategori ({categoryCounts.ALL || 0})</option>
                {categoryCounts.NONE > 0 && (
                  <option value="NONE">Tanpa Kategori ({categoryCounts.NONE || 0})</option>
                )}
                {availableCategories.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label || cat.shortLabel} ({categoryCounts[cat.key] || 0})
                  </option>
                ))}
              </select>
            </div>

            {showNewCategoryInput ? (
              <div className="category-inline-add-box">
                <input
                  type="text"
                  className="category-inline-add-input"
                  placeholder="Kategori baru (opsional)..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNewCategory();
                    if (e.key === "Escape") setShowNewCategoryInput(false);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveNewCategory}
                >
                  Simpan
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowNewCategoryInput(false)}
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-add-category-link"
                onClick={() => setShowNewCategoryInput(true)}
                title="Tambah kategori baru (opsional)"
              >
                + Tambah Kategori
              </button>
            )}
          </div>

          <div className="table-search-box">
            <svg
              className="search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari provider, nama paket, penyedia..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="table-search-input"
            />
            {searchTerm && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-alert" role="alert">
          {error}
        </div>
      )}

      <div className="table-scroll">
        <table className={`simcard-calc-table ${taxEnabled ? "is-tax-active" : ""}`}>
          <thead>
            <tr className="header-group-row">
              <th colSpan={baseColCount} className="group-header group-header-base">
                Data Produk {taxEnabled ? "& Modal (+Pajak)" : "& Modal"}
              </th>
              {Array.from({ length: NUM_SCENARIOS }, (_, i) => (
                <th
                  key={i}
                  className={`group-header ${SCENARIO_COLORS[i].class}`}
                  colSpan="2"
                >
                  S{i + 1} ({qtyLabels[i]} unit · {margins[i]}%)
                </th>
              ))}
              <th className="group-header group-header-action"></th>
            </tr>
            <tr className="header-columns-row">
              <th className="col-kategori">Kategori</th>
              <th className="col-penyedia text-center">Penyedia</th>
              <th className="col-stok">Stok</th>
              <th className="col-provider">Provider / Nama Paket</th>
              <th className="col-kuota text-right">Kuota (GB)</th>
              <th className="col-cogs text-right">COGS (Rp)</th>
              {taxEnabled && (
                <>
                  <th className="col-tax text-center">Pajak</th>
                  <th className="col-cogs-tax text-right">COGS + Pajak</th>
                </>
              )}
              {Array.from({ length: NUM_SCENARIOS }, (_, i) => (
                <React.Fragment key={i}>
                  <th className="col-price text-right">Harga Jual</th>
                  <th className="col-margin text-right">Margin</th>
                </React.Fragment>
              ))}
              <th className="col-action text-center"></th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={baseColCount + NUM_SCENARIOS * 2 + 1}
                  style={{
                    textAlign: "center",
                    padding: "36px 16px",
                    color: "var(--ink-muted)",
                    fontSize: "14px",
                  }}
                >
                  {data.length === 0
                    ? `Belum ada data ${typeConfig.label}. Klik "+ Tambah produk" atau import dari file Excel/CSV.`
                    : "Tidak ada produk yang cocok dengan filter atau kata kunci pencarian."}
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => (
                <ProductRow
                  key={row._originalIndex}
                  row={row}
                  index={row._originalIndex}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  taxEnabled={taxEnabled}
                  availableCategories={availableCategories}
                  onAddCustomCategory={handleAddCustomCategory}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      <div className="table-pagination-bar">
        <div className="pagination-info">
          Menampilkan <strong>{totalFilteredRows > 0 ? startIndex + 1 : 0} - {endIndex}</strong> dari{" "}
          <strong>{totalFilteredRows}</strong> produk
          {filteredData.length !== data.length && ` (total ${data.length})`}
        </div>

        <div className="pagination-controls-wrapper">
          <div className="pagination-size-select">
            <label htmlFor="pageSizeSelect">Tampilkan:</label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === "all" ? "all" : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
              <option value="all">Semua baris</option>
            </select>
          </div>

          {!isAll && totalPages > 1 && (
            <div className="pagination-pages">
              <button
                className="pagination-btn nav-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Halaman Sebelumnya"
                aria-label="Sebelumnya"
              >
                ‹
              </button>

              {pageNumbers.map((num, idx) =>
                num === "..." ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={num}
                    className={`pagination-btn ${currentPage === num ? "active" : ""}`}
                    onClick={() => setCurrentPage(num)}
                    aria-current={currentPage === num ? "page" : undefined}
                  >
                    {num}
                  </button>
                )
              )}

              <button
                className="pagination-btn nav-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Halaman Berikutnya"
                aria-label="Berikutnya"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="button-bar">
        <button className="btn btn-primary" onClick={handleAddProduct}>
          + Tambah produk
        </button>
        <button
          className="btn btn-success"
          onClick={handleDownloadExcel}
          disabled={isExporting}
          title="Unduh data tabel dalam format spreadsheet Excel (.xlsx)"
        >
          {isExporting ? "Mengunduh..." : "Download Excel (.xlsx)"}
        </button>
        <button
          className="btn"
          onClick={handleDownloadCSV}
          disabled={isExporting}
          title="Unduh data tabel dalam format CSV (.csv)"
        >
          Download CSV
        </button>
        <button className="btn" onClick={onReset}>
          Kembalikan data awal
        </button>
      </div>

      {children}
    </section>
  );
}
