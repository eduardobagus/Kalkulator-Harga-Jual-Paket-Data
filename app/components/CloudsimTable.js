"use client";

import React, { useState, useMemo, useCallback } from "react";
import { PRODUCT_TYPES, getProductTypeConfig } from "../lib/productTypes";
import UniversalImportModal from "./UniversalImportModal";
import { downloadCsvTemplate } from "../lib/templates";

const fmtRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function CloudsimTable({
  items = [],
  onUpdate,
  onDelete,
  onAdd,
  onBatchUpdate,
  productType = "cloudsim",
  onChangeProductType,
  typeCounts = {},
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({
    tipe_cloudsim: "Monthly Charge — 1 Provider",
    jumlah_provider: 1,
    negara: "Domestik",
    package_quota_gb: 1,
    licence_fee: 32000,
    simbank: 4167,
    quota_price: 6500,
    margin_pct: 30,
    bottom_line_pct: 20,
    remarks: "",
  });

  const typeConfig = getProductTypeConfig(productType);

  // Enriched Cloudsim items
  const enrichedItems = useMemo(() => {
    return items.map((item, originalIndex) => {
      const lFee =
        item.licence_fee !== null && item.licence_fee !== "" && !isNaN(parseFloat(item.licence_fee))
          ? parseFloat(item.licence_fee)
          : null;
      const sBank =
        item.simbank !== null && item.simbank !== "" && !isNaN(parseFloat(item.simbank))
          ? parseFloat(item.simbank)
          : null;
      const qPrice =
        item.quota_price !== null && item.quota_price !== "" && !isNaN(parseFloat(item.quota_price))
          ? parseFloat(item.quota_price)
          : null;
      const mPct = parseFloat(item.margin_pct) || 30;
      const bLine = parseFloat(item.bottom_line_pct) || 20;

      let cogs = null;
      let sp = null;
      let status = "Lengkap";

      if (lFee !== null && qPrice !== null) {
        cogs = (lFee || 0) + (sBank || 0) + (qPrice || 0);
        if (mPct < 100) {
          sp = Math.round(cogs / (1 - mPct / 100));
        }
      } else {
        status = "Belum Lengkap";
      }

      const isBelowBottomLine = mPct < bLine;

      return {
        ...item,
        _originalIndex: originalIndex,
        _lFee: lFee,
        _sBank: sBank,
        _qPrice: qPrice,
        _cogs: cogs,
        _sp: sp,
        _mPct: mPct,
        _bLine: bLine,
        _status: status,
        _isBelowBottomLine: isBelowBottomLine,
      };
    });
  }, [items]);

  // Categories
  const availableCategories = [
    { key: "Monthly Charge — 3 Provider", label: "Monthly Charge — 3 Provider" },
    { key: "Monthly Charge — 2 Provider", label: "Monthly Charge — 2 Provider" },
    { key: "Monthly Charge — 1 Provider", label: "Monthly Charge — 1 Provider" },
    { key: "Monthly Charge — 1 Provider Roaming", label: "Monthly Charge — 1 Provider Roaming" },
  ];

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { ALL: enrichedItems.length };
    availableCategories.forEach((c) => (counts[c.key] = 0));
    enrichedItems.forEach((item) => {
      const cat = item.kategori || item.tipe_cloudsim || "";
      const match = availableCategories.find((c) => cat.toLowerCase().includes(c.key.toLowerCase()));
      const key = match ? match.key : "Monthly Charge — 1 Provider";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [enrichedItems]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let lengkapCount = 0;
    let roamingCount = 0;
    enrichedItems.forEach((item) => {
      if (item._status === "Lengkap") lengkapCount++;
      if (item.negara && item.negara.toLowerCase() !== "domestik") roamingCount++;
    });

    return {
      total: enrichedItems.length,
      lengkapCount,
      incompleteCount: enrichedItems.length - lengkapCount,
      roamingCount,
      domestikCount: enrichedItems.length - roamingCount,
    };
  }, [enrichedItems]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      if (selectedCategory !== "ALL") {
        const cat = (item.kategori || item.tipe_cloudsim || "").toLowerCase();
        if (!cat.includes(selectedCategory.toLowerCase())) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const tipe = String(item.tipe_cloudsim || "").toLowerCase();
        const negara = String(item.negara || "").toLowerCase();
        const remarks = String(item.remarks || "").toLowerCase();
        if (!tipe.includes(term) && !negara.includes(term) && !remarks.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedItems, selectedCategory, searchTerm]);

  // Pagination
  const totalFilteredRows = filteredItems.length;
  const isAll = pageSize === "all";
  const effectivePageSize = isAll ? totalFilteredRows : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalFilteredRows / effectivePageSize));

  const startIndex = isAll ? 0 : (currentPage - 1) * effectivePageSize;
  const displayedItems = filteredItems.slice(startIndex, startIndex + effectivePageSize);

  // Field change handler (supports single field or multi-field patch object)
  const handleFieldChange = (originalIndex, fieldOrPatch, value) => {
    if (!onUpdate) return;
    const item = items[originalIndex];
    if (!item) return;

    const patch =
      typeof fieldOrPatch === "object" && fieldOrPatch !== null
        ? fieldOrPatch
        : { [fieldOrPatch]: value };

    const updated = { ...item, ...patch };

    // Auto-calculate COGS and SP if cost components or margin changes
    if (
      "licence_fee" in patch ||
      "simbank" in patch ||
      "quota_price" in patch ||
      "margin_pct" in patch
    ) {
      const l = updated.licence_fee !== "" && updated.licence_fee !== null ? parseFloat(updated.licence_fee) : null;
      const s = updated.simbank !== "" && updated.simbank !== null ? parseFloat(updated.simbank) : null;
      const q = updated.quota_price !== "" && updated.quota_price !== null ? parseFloat(updated.quota_price) : null;
      const m = parseFloat(updated.margin_pct) || 30;

      if (l !== null && q !== null) {
        updated.cogs = (l || 0) + (s || 0) + (q || 0);
        if (m < 100) updated.selling_price = Math.round(updated.cogs / (1 - m / 100));
        updated.status_kelengkapan = "Lengkap";
      } else {
        updated.cogs = null;
        updated.selling_price = null;
        updated.status_kelengkapan = "Belum Lengkap";
      }
    }

    onUpdate(originalIndex, updated);
  };

  // Add Item
  const handleSaveNew = () => {
    const l = newRow.licence_fee !== "" ? parseFloat(newRow.licence_fee) : null;
    const s = newRow.simbank !== "" ? parseFloat(newRow.simbank) : null;
    const q = newRow.quota_price !== "" ? parseFloat(newRow.quota_price) : null;
    const m = parseFloat(newRow.margin_pct) || 30;
    const b = parseFloat(newRow.bottom_line_pct) || 20;

    let cogs = null;
    let sp = null;
    let status = "Lengkap";
    if (l !== null && q !== null) {
      cogs = (l || 0) + (s || 0) + (q || 0);
      if (m < 100) sp = Math.round(cogs / (1 - m / 100));
    } else {
      status = "Belum Lengkap";
    }

    const itemToSave = {
      ...newRow,
      kategori: newRow.tipe_cloudsim,
      licence_fee: l,
      simbank: s,
      quota_price: q,
      cogs,
      margin_pct: m,
      bottom_line_pct: b,
      selling_price: sp,
      status_kelengkapan: status,
    };

    onAdd(itemToSave);
    setIsAddOpen(false);
    setNewRow({
      tipe_cloudsim: "Monthly Charge — 1 Provider",
      jumlah_provider: 1,
      negara: "Domestik",
      package_quota_gb: 1,
      licence_fee: 32000,
      simbank: 4167,
      quota_price: 6500,
      margin_pct: 30,
      bottom_line_pct: 20,
      remarks: "",
    });
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");
      const headerRow = [
        "No",
        "Tipe Cloudsim",
        "Jumlah Provider",
        "Negara",
        "Package Quota (GB)",
        "Licence Fee (Rp)",
        "Simbank (Rp)",
        "Quota Price (Rp)",
        "COGS (Rp)",
        "Margin (%)",
        "Bottom Line (%)",
        "Selling Price (Rp)",
        "Status",
        "Remarks",
      ];

      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.tipe_cloudsim,
        item.jumlah_provider,
        item.negara || "Domestik",
        item.package_quota_gb,
        item._lFee !== null ? item._lFee : "-",
        item._sBank !== null ? item._sBank : "-",
        item._qPrice !== null ? item._qPrice : "-",
        item._cogs !== null ? item._cogs : "-",
        `${item._mPct}%`,
        `${item._bLine}%`,
        item._sp !== null ? item._sp : "-",
        item._status,
        item.remarks || "-",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cloudsim");
      XLSX.writeFile(wb, `Cloudsim_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel Cloudsim:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const XLSX = await import("xlsx");
      const headerRow = [
        "No",
        "Tipe Cloudsim",
        "Jumlah Provider",
        "Negara",
        "Package Quota (GB)",
        "Licence Fee",
        "Simbank",
        "Quota Price",
        "COGS",
        "Markup",
        "Bottom Line",
        "Selling Price",
        "Status",
        "Remarks",
      ];
      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.tipe_cloudsim,
        item.jumlah_provider,
        item.negara || "Domestik",
        item.package_quota_gb,
        item._lFee !== null ? item._lFee : "",
        item._sBank !== null ? item._sBank : "",
        item._qPrice !== null ? item._qPrice : "",
        item._cogs !== null ? item._cogs : "",
        `${item._mPct}%`,
        `${item._bLine}%`,
        item._sp !== null ? item._sp : "",
        item._status,
        item.remarks || "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cloudsim_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV Cloudsim:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <section className="card card-delay-2">
        {/* Title Header with Product Type Dropdown */}
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
                {filteredItems.length !== items.length
                  ? `${filteredItems.length} dari ${items.length} paket`
                  : `${items.length} paket`}
              </span>
            </h2>
          </div>

          <span className="product-header-hint">
            Kalkulator Cloudsim — 3 Provider, 2 Provider, 1 Provider & Roaming Internasional
          </span>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-summary-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total Paket Cloudsim</span>
            <span className="kpi-value text-accent">{kpis.total} Paket</span>
            <span className="kpi-sub">
              {kpis.domestikCount} Domestik, {kpis.roamingCount} Roaming
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Status Kelengkapan Biaya</span>
            <span className="kpi-value text-success">{kpis.lengkapCount} Lengkap</span>
            <span className="kpi-sub">
              {kpis.incompleteCount > 0
                ? `${kpis.incompleteCount} paket belum lengkap komponen biayanya`
                : "Semua komponen biaya COGS valid"}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Komponen COGS Cloudsim</span>
            <span className="kpi-value">Licence + Simbank + Quota</span>
            <span className="kpi-sub">Batas Minimum Bottom Line: 20%</span>
          </div>
        </div>

        {/* Filter and Action Bar */}
        <div className="category-filter-wrapper">
          <div className="category-filter-top">
            <div className="category-filter-left">
              <label htmlFor="cloudsimCategorySelect" className="category-filter-label">
                Kategori:
              </label>
              <div className="category-select-wrapper">
                <select
                  id="cloudsimCategorySelect"
                  className="category-filter-select"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">Semua Kategori ({categoryCounts.ALL || 0})</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label} ({categoryCounts[cat.key] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="category-filter-right">
              <div className="search-box-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Cari Tipe Cloudsim / Negara..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchTerm("")}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Table Responsive Container */}
        <div className="tbl-container">
          <table className="calc-table cloudsim-table">
            <thead>
              <tr className="tbl-header-top">
                <th className="tbl-th-center" style={{ width: "45px" }}>No</th>
                <th style={{ minWidth: "210px" }}>Tipe Cloudsim</th>
                <th className="tbl-th-center" style={{ minWidth: "80px" }}>Provider</th>
                <th style={{ minWidth: "100px" }}>Negara</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Kuota (GB)</th>
                <th className="tbl-th-right" style={{ minWidth: "120px" }}>Licence Fee</th>
                <th className="tbl-th-right" style={{ minWidth: "110px" }}>Simbank</th>
                <th className="tbl-th-right" style={{ minWidth: "120px" }}>Quota Price</th>
                <th className="tbl-th-right" style={{ minWidth: "130px" }}>COGS</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Margin (%)</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Bottom Line</th>
                <th className="tbl-th-right" style={{ minWidth: "150px" }}>Selling Price</th>
                <th className="tbl-th-center" style={{ minWidth: "110px" }}>Status</th>
                <th style={{ minWidth: "120px" }}>Remarks</th>
                <th className="tbl-th-center" style={{ width: "60px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="15" className="tbl-empty-cell">
                    Belum ada data Cloudsim. Klik "+ Tambah Cloudsim" atau "Upload Massal".
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const actualIdx = item._originalIndex;

                  return (
                    <tr key={item.id || actualIdx} className="tbl-row">
                      <td className="tbl-td-center text-muted">{startIndex + idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input font-semibold"
                          value={item.tipe_cloudsim || ""}
                          placeholder="Nama Tipe Cloudsim..."
                          onChange={(e) => handleFieldChange(actualIdx, "tipe_cloudsim", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <input
                          type="number"
                          className="tbl-input tbl-input-center"
                          style={{ width: "50px" }}
                          value={item.jumlah_provider || 1}
                          onChange={(e) =>
                            handleFieldChange(actualIdx, "jumlah_provider", parseInt(e.target.value, 10) || 1)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input"
                          style={{ width: "95px" }}
                          value={item.negara || "Domestik"}
                          onChange={(e) => handleFieldChange(actualIdx, "negara", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <input
                          type="number"
                          className="tbl-input tbl-input-center"
                          style={{ width: "60px" }}
                          value={item.package_quota_gb || 1}
                          onChange={(e) =>
                            handleFieldChange(actualIdx, "package_quota_gb", parseFloat(e.target.value) || 1)
                          }
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._lFee !== null ? item._lFee : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "licence_fee", val);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._sBank !== null ? item._sBank : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "simbank", val);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._qPrice !== null ? item._qPrice : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "quota_price", val);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right font-mono font-semibold">
                        {item._cogs !== null ? fmtRupiah.format(item._cogs) : <span className="text-muted">-</span>}
                      </td>
                      <td className="tbl-td-center">
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <input
                            type="number"
                            step="0.5"
                            className={`tbl-input tbl-input-center ${
                              item._isBelowBottomLine ? "text-error font-bold" : ""
                            }`}
                            style={{ width: "50px" }}
                            value={item.margin_pct ?? 30}
                            onChange={(e) => handleFieldChange(actualIdx, "margin_pct", e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="tbl-td-center text-muted font-mono">
                        {item._bLine}%
                      </td>
                      <td className="tbl-td-right font-mono font-bold text-accent" style={{ fontSize: "14px" }}>
                        {item._sp !== null ? fmtRupiah.format(item._sp) : <span className="text-muted">-</span>}
                      </td>
                      <td className="tbl-td-center">
                        <span
                          className={`badge ${
                            item._status === "Lengkap" ? "badge-success" : "badge-warning"
                          }`}
                        >
                          {item._status}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input text-muted"
                          placeholder="Catatan..."
                          value={item.remarks || ""}
                          onChange={(e) => handleFieldChange(actualIdx, "remarks", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <button
                          type="button"
                          className="tbl-delete-btn"
                          title="Hapus baris"
                          onClick={() => {
                            const name = item.tipe_cloudsim ? `"${item.tipe_cloudsim}"` : "paket ini";
                            if (window.confirm(`Apakah Anda yakin ingin menghapus data Cloudsim ${name}?`)) {
                              onDelete && onDelete(actualIdx);
                            }
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalFilteredRows > 0 && (
          <div className="table-pagination-bar">
            <div className="pagination-info">
              Menampilkan {startIndex + 1}–{Math.min(startIndex + effectivePageSize, totalFilteredRows)} dari {totalFilteredRows} paket
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn btn-sm"
                disabled={currentPage === 1 || isAll}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </button>
              <span className="pagination-current">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={currentPage >= totalPages || isAll}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}

        {/* Unified Button Bar matching SIMCARD */}
        <div className="button-bar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddOpen(true)}
          >
            + Tambah Cloudsim
          </button>
          <button
            type="button"
            className="btn btn-success"
            disabled={isExporting}
            onClick={handleExportExcel}
            title="Unduh data tabel dalam format spreadsheet Excel (.xlsx)"
          >
            {isExporting ? "Mengunduh..." : "Download Excel (.xlsx)"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={isExporting}
            onClick={handleExportCSV}
            title="Unduh data tabel dalam format CSV (.csv)"
          >
            Download CSV
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setIsImportModalOpen(true)}
            title="Upload massal data melalui Excel atau CSV"
          >
            Upload massal
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadCsvTemplate(productType)}
            title="Download template file CSV"
          >
            Template CSV
          </button>
        </div>
      </section>

      {/* Add Cloudsim Modal */}
      {isAddOpen && (
        <div className="universal-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div
            className="universal-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "580px" }}
          >
            <div className="universal-modal-header">
              <h3 className="universal-modal-title">Tambah Paket Cloudsim Baru</h3>
              <button
                type="button"
                className="universal-modal-close"
                onClick={() => setIsAddOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="universal-modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="modal-form-group">
                <label>Tipe Cloudsim:</label>
                <input
                  type="text"
                  className="tbl-input font-semibold"
                  placeholder="Contoh: Monthly Charge — 3 Provider"
                  value={newRow.tipe_cloudsim}
                  onChange={(e) => setNewRow({ ...newRow, tipe_cloudsim: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="modal-form-group">
                  <label>Jml Provider:</label>
                  <input
                    type="number"
                    className="tbl-input"
                    value={newRow.jumlah_provider}
                    onChange={(e) =>
                      setNewRow({
                        ...newRow,
                        jumlah_provider: parseInt(e.target.value, 10) || 1,
                      })
                    }
                  />
                </div>

                <div className="modal-form-group">
                  <label>Negara:</label>
                  <input
                    type="text"
                    className="tbl-input"
                    placeholder="Domestik / Malaysia"
                    value={newRow.negara}
                    onChange={(e) => setNewRow({ ...newRow, negara: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Kuota (GB):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    value={newRow.package_quota_gb}
                    onChange={(e) =>
                      setNewRow({
                        ...newRow,
                        package_quota_gb: parseFloat(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="modal-form-group">
                  <label>Licence Fee (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="misal: 32000"
                    value={newRow.licence_fee}
                    onChange={(e) => setNewRow({ ...newRow, licence_fee: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Simbank (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="Kosong jika Roaming"
                    value={newRow.simbank}
                    onChange={(e) => setNewRow({ ...newRow, simbank: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Quota Price (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="misal: 6500"
                    value={newRow.quota_price}
                    onChange={(e) => setNewRow({ ...newRow, quota_price: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Margin (%):</label>
                  <input
                    type="number"
                    step="0.5"
                    className="tbl-input"
                    value={newRow.margin_pct}
                    onChange={(e) => setNewRow({ ...newRow, margin_pct: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Bottom Line (%):</label>
                  <input
                    type="number"
                    step="0.5"
                    className="tbl-input"
                    value={newRow.bottom_line_pct}
                    onChange={(e) => setNewRow({ ...newRow, bottom_line_pct: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <label>Remarks / Catatan:</label>
                <input
                  type="text"
                  className="tbl-input"
                  placeholder="Catatan..."
                  value={newRow.remarks}
                  onChange={(e) => setNewRow({ ...newRow, remarks: e.target.value })}
                />
              </div>

              {/* Preview */}
              <div className="modal-calc-preview">
                {newRow.licence_fee && newRow.quota_price ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span>Total COGS:</span>
                      <strong>
                        {fmtRupiah.format(
                          (parseFloat(newRow.licence_fee) || 0) +
                            (parseFloat(newRow.simbank) || 0) +
                            (parseFloat(newRow.quota_price) || 0)
                        )}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Estimasi Harga Jual:</span>
                      <strong className="text-accent" style={{ fontSize: "16px" }}>
                        {fmtRupiah.format(
                          Math.round(
                            ((parseFloat(newRow.licence_fee) || 0) +
                              (parseFloat(newRow.simbank) || 0) +
                              (parseFloat(newRow.quota_price) || 0)) /
                              (1 - (parseFloat(newRow.margin_pct) || 30) / 100)
                          )
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="text-warning">
                    Biaya belum lengkap (Licence Fee dan Quota Price wajib diisi).
                  </div>
                )}
              </div>
            </div>

            <div className="universal-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveNew}
              >
                Simpan Cloudsim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Import Modal */}
      <UniversalImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        productType={productType}
        onImport={(importedRows, replaceAll) => {
          if (onBatchUpdate) {
            onBatchUpdate(importedRows, replaceAll);
          }
        }}
      />
    </>
  );
}
