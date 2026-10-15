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

export default function RouterTable({
  items = [],
  onUpdate,
  onDelete,
  onAdd,
  onBatchUpdate,
  productType = "router",
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
    kategori: "Beli Putus",
    nama_produk: "",
    jenis_transaksi: "Beli Putus",
    jangka_waktu_sewa: null,
    min_qty: 1,
    max_qty: 9,
    cogs_cku: "",
    cogs_rts: "",
    margin_pct: 45,
    remarks: "",
  });

  const typeConfig = getProductTypeConfig(productType);

  // Enriched calculation for each Router item
  const enrichedItems = useMemo(() => {
    return items.map((item, originalIndex) => {
      const mPct = parseFloat(item.margin_pct) || 0;
      const rts =
        item.cogs_rts !== null && item.cogs_rts !== "" && !isNaN(parseFloat(item.cogs_rts))
          ? parseFloat(item.cogs_rts)
          : null;
      const cku =
        item.cogs_cku !== null && item.cogs_cku !== "" && !isNaN(parseFloat(item.cogs_cku))
          ? parseFloat(item.cogs_cku)
          : null;

      let sp = null;
      let gp = null;
      if (rts !== null && rts > 0 && mPct < 100) {
        // Excel formula for router: Margin calculation COGS RTS / (1 - Margin) rounded to nearest 5.000
        const raw = rts / (1 - mPct / 100);
        sp = Math.round(raw / 5000) * 5000;
        gp = sp - rts;
      }

      return {
        ...item,
        _originalIndex: originalIndex,
        _cku: cku,
        _rts: rts,
        _sp: sp,
        _gp: gp,
        _marginPct: mPct,
      };
    });
  }, [items]);

  // Categories / Transaction types
  const availableCategories = [
    { key: "Beli Putus", label: "Beli Putus" },
    { key: "Sewa", label: "Sewa" },
    { key: "Aksesoris", label: "Aksesoris" },
    { key: "Dongle", label: "Dongle" },
  ];

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { ALL: enrichedItems.length };
    availableCategories.forEach((c) => (counts[c.key] = 0));
    enrichedItems.forEach((item) => {
      const jenis = item.jenis_transaksi || item.kategori || "Beli Putus";
      const key = availableCategories.find((c) => c.key.toLowerCase() === jenis.toLowerCase())?.key || "Beli Putus";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [enrichedItems]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let beliCount = 0;
    let sewaCount = 0;
    let aksesorisCount = 0;
    let validCogsCount = 0;

    enrichedItems.forEach((item) => {
      const jenis = (item.jenis_transaksi || "").toLowerCase();
      if (jenis.includes("sewa")) sewaCount++;
      else if (jenis.includes("aksesoris")) aksesorisCount++;
      else beliCount++;

      if (item._rts !== null) validCogsCount++;
    });

    return {
      total: enrichedItems.length,
      beliCount,
      sewaCount,
      aksesorisCount,
      validCogsCount,
      emptyCogsCount: enrichedItems.length - validCogsCount,
    };
  }, [enrichedItems]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      if (selectedCategory !== "ALL") {
        const jenis = (item.jenis_transaksi || item.kategori || "").toLowerCase();
        if (!jenis.includes(selectedCategory.toLowerCase())) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nama = String(item.nama_produk || "").toLowerCase();
        const jenis = String(item.jenis_transaksi || "").toLowerCase();
        const remarks = String(item.remarks || "").toLowerCase();
        if (!nama.includes(term) && !jenis.includes(term) && !remarks.includes(term)) {
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

    // Recalculate SP & GP live if margin or COGS RTS changes
    if ("cogs_rts" in patch || "margin_pct" in patch) {
      const rts =
        updated.cogs_rts !== null && updated.cogs_rts !== "" && !isNaN(parseFloat(updated.cogs_rts))
          ? parseFloat(updated.cogs_rts)
          : null;
      const mPct = parseFloat(updated.margin_pct) || 0;

      if (rts !== null && rts > 0 && mPct < 100) {
        const raw = rts / (1 - mPct / 100);
        updated.selling_price = Math.round(raw / 5000) * 5000;
        updated.gross_profit = updated.selling_price - rts;
      } else {
        updated.selling_price = null;
        updated.gross_profit = null;
      }
    }

    onUpdate(originalIndex, updated);
  };

  // Add Item
  const handleSaveNew = () => {
    if (!newRow.nama_produk.trim()) {
      alert("Nama Produk wajib diisi.");
      return;
    }

    const rts = newRow.cogs_rts !== "" && newRow.cogs_rts !== null ? parseFloat(newRow.cogs_rts) : null;
    const cku = newRow.cogs_cku !== "" && newRow.cogs_cku !== null ? parseFloat(newRow.cogs_cku) : null;
    const mPct = parseFloat(newRow.margin_pct) || 45;

    let sp = null;
    let gp = null;
    if (rts !== null && rts > 0 && mPct < 100) {
      const raw = rts / (1 - mPct / 100);
      sp = Math.round(raw / 5000) * 5000;
      gp = sp - rts;
    }

    const itemToSave = {
      ...newRow,
      kategori: newRow.jenis_transaksi,
      cogs_cku: cku,
      cogs_rts: rts,
      margin_pct: mPct,
      selling_price: sp,
      gross_profit: gp,
    };

    onAdd(itemToSave);
    setIsAddOpen(false);
    setNewRow({
      kategori: "Beli Putus",
      nama_produk: "",
      jenis_transaksi: "Beli Putus",
      jangka_waktu_sewa: null,
      min_qty: 1,
      max_qty: 9,
      cogs_cku: "",
      cogs_rts: "",
      margin_pct: 45,
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
        "Nama Produk",
        "Jenis Transaksi",
        "Jangka Waktu Sewa",
        "Minimum Quantity",
        "Maximum Quantity",
        "COGS CKU (Rp)",
        "COGS RTS (Rp)",
        "Margin (%)",
        "Harga Jual (Rp)",
        "Gross Profit (Rp)",
        "Remarks",
      ];

      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.nama_produk,
        item.jenis_transaksi,
        item.jangka_waktu_sewa ? `${item.jangka_waktu_sewa} bulan` : "-",
        item.min_qty,
        item.max_qty,
        item._cku !== null ? item._cku : "-",
        item._rts !== null ? item._rts : "-",
        `${item._marginPct}%`,
        item._sp !== null ? item._sp : "-",
        item._gp !== null ? item._gp : "-",
        item.remarks || "-",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Router");
      XLSX.writeFile(wb, `Router_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel Router:", err);
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
        "Nama Produk",
        "Jenis Transaksi",
        "Jangka Waktu Sewa",
        "Minimum Quantity",
        "Maximum Quantity",
        "COGS CKU",
        "COGS RTS",
        "Markup",
        "Selling Price",
        "Gross Profit",
        "Remarks",
      ];
      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.nama_produk,
        item.jenis_transaksi,
        item.jangka_waktu_sewa ? `${item.jangka_waktu_sewa} bulan` : "",
        item.min_qty,
        item.max_qty,
        item._cku !== null ? item._cku : "",
        item._rts !== null ? item._rts : "",
        `${item._marginPct}%`,
        item._sp !== null ? item._sp : "",
        item._gp !== null ? item._gp : "",
        item.remarks || "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Router_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV Router:", err);
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
                  ? `${filteredItems.length} dari ${items.length} produk`
                  : `${items.length} produk`}
              </span>
            </h2>
          </div>

          <span className="product-header-hint">
            Kalkulator Router & Aksesoris — Beli Putus, Sewa, Margin & Gross Profit otomatis
          </span>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-summary-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total Produk Router</span>
            <span className="kpi-value text-accent">{kpis.total} Item</span>
            <span className="kpi-sub">
              {kpis.beliCount} Beli Putus, {kpis.sewaCount} Sewa, {kpis.aksesorisCount} Aksesoris
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Kelengkapan COGS</span>
            <span className="kpi-value text-success">{kpis.validCogsCount} Lengkap</span>
            <span className="kpi-sub">
              {kpis.emptyCogsCount > 0
                ? `${kpis.emptyCogsCount} produk COGS kosong (ditampilkan '-')`
                : "Semua harga dasar terisi"}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Formula Margin</span>
            <span className="kpi-value">SP = RTS / (1 - M%)</span>
            <span className="kpi-sub">Gross Profit = Harga Jual - COGS RTS</span>
          </div>
        </div>

        {/* Filter and Action Bar */}
        <div className="category-filter-wrapper">
          <div className="category-filter-top">
            <div className="category-filter-left">
              <label htmlFor="routerCategorySelect" className="category-filter-label">
                Jenis:
              </label>
              <div className="category-select-wrapper">
                <select
                  id="routerCategorySelect"
                  className="category-filter-select"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">Semua Jenis ({categoryCounts.ALL || 0})</option>
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
                  placeholder="Cari Nama Router / Catatan..."
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
          <table className="calc-table router-table">
            <thead>
              <tr className="tbl-header-top">
                <th className="tbl-th-center" style={{ width: "45px" }}>No</th>
                <th style={{ minWidth: "220px" }}>Nama Produk</th>
                <th style={{ minWidth: "120px" }}>Jenis Transaksi</th>
                <th className="tbl-th-center" style={{ minWidth: "100px" }}>Jangka Sewa</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Qty Tier</th>
                <th className="tbl-th-right" style={{ minWidth: "130px" }}>COGS CKU</th>
                <th className="tbl-th-right" style={{ minWidth: "130px" }}>COGS RTS</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Margin (%)</th>
                <th className="tbl-th-right" style={{ minWidth: "150px" }}>Selling Price</th>
                <th className="tbl-th-right" style={{ minWidth: "140px" }}>Gross Profit</th>
                <th style={{ minWidth: "130px" }}>Remarks</th>
                <th className="tbl-th-center" style={{ width: "60px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="12" className="tbl-empty-cell">
                    Belum ada data Router. Klik "+ Tambah Router" atau "Upload Massal".
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const actualIdx = item._originalIndex;
                  const isSewa = (item.jenis_transaksi || "").toLowerCase() === "sewa";

                  return (
                    <tr key={item.id || actualIdx} className="tbl-row">
                      <td className="tbl-td-center text-muted">{startIndex + idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input font-semibold"
                          value={item.nama_produk || ""}
                          placeholder="Nama Router..."
                          onChange={(e) => handleFieldChange(actualIdx, "nama_produk", e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="tbl-select-cat"
                          value={item.jenis_transaksi || "Beli Putus"}
                          onChange={(e) => {
                            const val = e.target.value;
                            const patch = {
                              jenis_transaksi: val,
                              kategori: val,
                            };
                            if (val === "Sewa" && !item.jangka_waktu_sewa) {
                              patch.jangka_waktu_sewa = 12;
                            }
                            handleFieldChange(actualIdx, patch);
                          }}
                        >
                          <option value="Beli Putus">Beli Putus</option>
                          <option value="Sewa">Sewa</option>
                          <option value="Aksesoris">Aksesoris</option>
                          <option value="Dongle">Dongle</option>
                        </select>
                      </td>
                      <td className="tbl-td-center">
                        {isSewa ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <input
                              type="number"
                              className="tbl-input tbl-input-center"
                              style={{ width: "45px" }}
                              value={item.jangka_waktu_sewa || 12}
                              onChange={(e) =>
                                handleFieldChange(actualIdx, "jangka_waktu_sewa", parseInt(e.target.value, 10) || null)
                              }
                            />
                            <span className="text-muted" style={{ fontSize: "12px" }}>bln</span>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="tbl-td-center">
                        <input
                          type="text"
                          className="tbl-input tbl-input-center text-muted"
                          style={{ width: "70px" }}
                          value={`${item.min_qty || 1}–${item.max_qty || 9}`}
                          onChange={(e) => {
                            const parts = e.target.value.split(/[-–]/);
                            const patch = {};
                            if (parts[0]) patch.min_qty = parseInt(parts[0], 10) || 1;
                            if (parts[1]) patch.max_qty = parseInt(parts[1], 10) || 9;
                            handleFieldChange(actualIdx, patch);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._cku !== null ? item._cku : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "cogs_cku", val);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._rts !== null ? item._rts : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "cogs_rts", val);
                          }}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <input
                            type="number"
                            step="0.5"
                            className="tbl-input tbl-input-center"
                            style={{ width: "50px" }}
                            value={item.margin_pct ?? 45}
                            onChange={(e) => handleFieldChange(actualIdx, "margin_pct", e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="tbl-td-right font-mono font-bold text-accent" style={{ fontSize: "14px" }}>
                        {item._sp !== null ? (
                          <>
                            {fmtRupiah.format(item._sp)}
                            {isSewa && <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--ink-muted)" }}>/bln</span>}
                          </>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="tbl-td-right font-mono font-semibold text-success">
                        {item._gp !== null ? fmtRupiah.format(item._gp) : <span className="text-muted">-</span>}
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
                            const name = item.nama_produk ? `"${item.nama_produk}"` : "produk ini";
                            if (window.confirm(`Apakah Anda yakin ingin menghapus data router ${name}?`)) {
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
              Menampilkan {startIndex + 1}–{Math.min(startIndex + effectivePageSize, totalFilteredRows)} dari {totalFilteredRows} router
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
            + Tambah Router
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

      {/* Add Router Modal */}
      {isAddOpen && (
        <div className="universal-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div
            className="universal-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className="universal-modal-header">
              <h3 className="universal-modal-title">Tambah Produk Router Baru</h3>
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
                <label>Nama Produk:</label>
                <input
                  type="text"
                  className="tbl-input font-semibold"
                  placeholder="Contoh: Router C9 Non-IP SEC"
                  value={newRow.nama_produk}
                  onChange={(e) => setNewRow({ ...newRow, nama_produk: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Jenis Transaksi:</label>
                  <select
                    className="tbl-select-cat"
                    value={newRow.jenis_transaksi}
                    onChange={(e) => {
                      const j = e.target.value;
                      setNewRow({
                        ...newRow,
                        jenis_transaksi: j,
                        kategori: j,
                        jangka_waktu_sewa: j === "Sewa" ? 12 : null,
                      });
                    }}
                  >
                    <option value="Beli Putus">Beli Putus</option>
                    <option value="Sewa">Sewa</option>
                    <option value="Aksesoris">Aksesoris</option>
                    <option value="Dongle">Dongle</option>
                  </select>
                </div>

                <div className="modal-form-group">
                  <label>Jangka Sewa (Bulan):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    disabled={newRow.jenis_transaksi !== "Sewa"}
                    placeholder={newRow.jenis_transaksi === "Sewa" ? "12" : "-"}
                    value={newRow.jangka_waktu_sewa || ""}
                    onChange={(e) =>
                      setNewRow({
                        ...newRow,
                        jangka_waktu_sewa: parseInt(e.target.value, 10) || null,
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>COGS CKU (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="Kosongkan jika belum ada"
                    value={newRow.cogs_cku}
                    onChange={(e) => setNewRow({ ...newRow, cogs_cku: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>COGS RTS (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="Kosongkan jika belum ada"
                    value={newRow.cogs_rts}
                    onChange={(e) => setNewRow({ ...newRow, cogs_rts: e.target.value })}
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
                  <label>Tier Qty:</label>
                  <input
                    type="text"
                    className="tbl-input"
                    placeholder="1–9"
                    value={`${newRow.min_qty}–${newRow.max_qty}`}
                    onChange={(e) => {
                      const p = e.target.value.split(/[-–]/);
                      setNewRow({
                        ...newRow,
                        min_qty: parseInt(p[0], 10) || 1,
                        max_qty: parseInt(p[1], 10) || 9,
                      });
                    }}
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
                {newRow.cogs_rts !== "" && !isNaN(parseFloat(newRow.cogs_rts)) ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span>Estimasi Harga Jual (SP):</span>
                      <strong className="text-accent">
                        {fmtRupiah.format(
                          Math.round(
                            (parseFloat(newRow.cogs_rts) /
                              (1 - (parseFloat(newRow.margin_pct) || 0) / 100)) /
                              5000
                          ) * 5000
                        )}
                        {newRow.jenis_transaksi === "Sewa" && " / bln"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Gross Profit:</span>
                      <strong className="text-success">
                        {fmtRupiah.format(
                          Math.round(
                            (parseFloat(newRow.cogs_rts) /
                              (1 - (parseFloat(newRow.margin_pct) || 0) / 100)) /
                              5000
                          ) *
                            5000 -
                            parseFloat(newRow.cogs_rts)
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div className="text-muted" style={{ fontStyle: "italic" }}>
                    COGS RTS belum diisi. Harga jual akan ditampilkan sebagai '-' tanpa angka fiktif.
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
                Simpan Router
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
