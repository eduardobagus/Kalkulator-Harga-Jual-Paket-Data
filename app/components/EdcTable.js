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

const fmtNum = new Intl.NumberFormat("id-ID");

export default function EdcTable({
  items = [],
  onUpdate,
  onDelete,
  onAdd,
  onBatchUpdate,
  productType = "edc_referral",
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

  // Inline/Modal Add State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({
    kategori: "EDC — One Time Charge",
    tipe_transaksi: "ONE_TIME",
    spec_type: "",
    tier_min_qty: 1,
    tier_max_qty: 200,
    selling_price: 2875000,
    referral_fee_pct: 5,
    simulation_qty: 200,
    remarks: "",
  });

  const typeConfig = getProductTypeConfig(productType);

  // Enriched items with calculated fee
  const enrichedItems = useMemo(() => {
    return items.map((item, originalIndex) => {
      const sp = parseFloat(item.selling_price) || 0;
      const feePct = parseFloat(item.referral_fee_pct) || 0;
      const simQty = parseInt(item.simulation_qty, 10) || 1;
      const feePerUnit = Math.round(sp * (feePct / 100));
      const totalFee = feePerUnit * simQty;

      return {
        ...item,
        _originalIndex: originalIndex,
        _feePerUnit: feePerUnit,
        _totalFee: totalFee,
      };
    });
  }, [items]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalPotensiFee = 0;
    let oneTimeCount = 0;
    let rentCount = 0;

    enrichedItems.forEach((item) => {
      totalPotensiFee += item._totalFee || 0;
      if (item.tipe_transaksi === "MONTHLY_RENT" || item.kategori?.includes("Rent")) {
        rentCount++;
      } else {
        oneTimeCount++;
      }
    });

    return {
      totalItems: enrichedItems.length,
      totalPotensiFee,
      oneTimeCount,
      rentCount,
    };
  }, [enrichedItems]);

  // Categories
  const availableCategories = [
    { key: "EDC — One Time Charge", label: "EDC — One Time Charge" },
    { key: "EDC — Rent (Monthly Charge)", label: "EDC — Rent (Monthly Charge)" },
  ];

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { ALL: enrichedItems.length };
    availableCategories.forEach((c) => (counts[c.key] = 0));
    enrichedItems.forEach((item) => {
      const cat = item.kategori || "EDC — One Time Charge";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [enrichedItems]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      if (selectedCategory !== "ALL") {
        if (item.kategori !== selectedCategory) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const spec = String(item.spec_type || "").toLowerCase();
        const cat = String(item.kategori || "").toLowerCase();
        const remarks = String(item.remarks || "").toLowerCase();
        if (!spec.includes(term) && !cat.includes(term) && !remarks.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedItems, selectedCategory, searchTerm]);

  // Pagination calculation
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

    // Auto-update calculations if SP, fee %, or sim qty changes
    if ("selling_price" in patch || "referral_fee_pct" in patch || "simulation_qty" in patch) {
      const sp = parseFloat(updated.selling_price) || 0;
      const feePct = parseFloat(updated.referral_fee_pct) || 0;
      const simQty = parseInt(updated.simulation_qty, 10) || 1;
      updated.referral_fee_per_unit = Math.round(sp * (feePct / 100));
      updated.total_referral_fee = updated.referral_fee_per_unit * simQty;
    }

    onUpdate(originalIndex, updated);
  };

  // Add Item
  const handleSaveNew = () => {
    if (!newRow.spec_type.trim()) {
      alert("Spec Type wajib diisi.");
      return;
    }
    const sp = parseFloat(newRow.selling_price) || 0;
    const feePct = parseFloat(newRow.referral_fee_pct) || 0;
    const simQty = parseInt(newRow.simulation_qty, 10) || 1;
    const feePerUnit = Math.round(sp * (feePct / 100));
    const totalFee = feePerUnit * simQty;

    const itemToSave = {
      ...newRow,
      selling_price: sp,
      referral_fee_pct: feePct,
      simulation_qty: simQty,
      referral_fee_per_unit: feePerUnit,
      total_referral_fee: totalFee,
    };

    onAdd(itemToSave);
    setIsAddOpen(false);
    setNewRow({
      kategori: "EDC — One Time Charge",
      tipe_transaksi: "ONE_TIME",
      spec_type: "",
      tier_min_qty: 1,
      tier_max_qty: 200,
      selling_price: 2875000,
      referral_fee_pct: 5,
      simulation_qty: 200,
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
        "Kategori / Skema",
        "Spec Type",
        "Tier Quantity",
        "Selling Price (Rp)",
        "Referral Fee (%)",
        "Referral Fee per Unit (Rp)",
        "Simulasi Quantity",
        "Total Referral Fee (Rp)",
        "Remarks",
      ];

      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.kategori,
        item.spec_type,
        `${item.tier_min_qty}–${item.tier_max_qty}`,
        item.selling_price,
        `${item.referral_fee_pct}%`,
        item._feePerUnit,
        item.simulation_qty,
        item._totalFee,
        item.remarks || "-",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Referral Fee EDC");
      XLSX.writeFile(wb, `Referral_Fee_EDC_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel EDC:", err);
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
        "Kategori",
        "Spec Type",
        "Tier Quantity",
        "Selling Price",
        "Referral Fee Percentage",
        "Referral Fee per Unit",
        "Simulation Quantity",
        "Total Referral Fee",
        "Remarks",
      ];
      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.kategori,
        item.spec_type,
        `${item.tier_min_qty}–${item.tier_max_qty}`,
        item.selling_price,
        `${item.referral_fee_pct}%`,
        item._feePerUnit,
        item.simulation_qty,
        item._totalFee,
        item.remarks || "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Referral_Fee_EDC_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV EDC:", err);
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
            Kalkulasi Referral Fee EDC — Mendukung One Time Charge & Monthly Rent
          </span>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-summary-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total Potensi Referral Fee</span>
            <span className="kpi-value text-accent">
              {fmtRupiah.format(kpis.totalPotensiFee)}
            </span>
            <span className="kpi-sub">Dari total simulasi kuantitas aktif</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">EDC — One Time Charge</span>
            <span className="kpi-value">{kpis.oneTimeCount} Item</span>
            <span className="kpi-sub">Biaya jual sekali bayar (beli putus)</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">EDC — Monthly Rent</span>
            <span className="kpi-value">{kpis.rentCount} Item</span>
            <span className="kpi-sub">Biaya sewa bulanan berulang</span>
          </div>
        </div>

        {/* Filter and Action Bar */}
        <div className="category-filter-wrapper">
          <div className="category-filter-top">
            <div className="category-filter-left">
              <label htmlFor="edcCategorySelect" className="category-filter-label">
                Skema:
              </label>
              <div className="category-select-wrapper">
                <select
                  id="edcCategorySelect"
                  className="category-filter-select"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">Semua Skema ({categoryCounts.ALL || 0})</option>
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
                  placeholder="Cari Spec Type / Catatan..."
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
          <table className="calc-table edc-table">
            <thead>
              <tr className="tbl-header-top">
                <th className="tbl-th-center" style={{ width: "50px" }}>No</th>
                <th style={{ minWidth: "180px" }}>Skema / Kategori</th>
                <th style={{ minWidth: "120px" }}>Spec Type</th>
                <th style={{ minWidth: "110px" }}>Tier Qty</th>
                <th className="tbl-th-right" style={{ minWidth: "140px" }}>Harga Jual (SP)</th>
                <th className="tbl-th-center" style={{ minWidth: "100px" }}>Fee (%)</th>
                <th className="tbl-th-right" style={{ minWidth: "140px" }}>Fee / Unit</th>
                <th className="tbl-th-center" style={{ minWidth: "110px" }}>Simulasi Qty</th>
                <th className="tbl-th-right" style={{ minWidth: "160px" }}>Total Referral Fee</th>
                <th style={{ minWidth: "140px" }}>Remarks</th>
                <th className="tbl-th-center" style={{ width: "70px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="11" className="tbl-empty-cell">
                    Belum ada data Referral Fee EDC. Klik "+ Tambah EDC" atau "Upload Massal".
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const actualIdx = item._originalIndex;
                  return (
                    <tr key={item.id || actualIdx} className="tbl-row">
                      <td className="tbl-td-center text-muted">{startIndex + idx + 1}</td>
                      <td>
                        <select
                          className="tbl-select-cat"
                          value={item.kategori}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleFieldChange(actualIdx, {
                              kategori: val,
                              tipe_transaksi: val.includes("Rent") ? "MONTHLY_RENT" : "ONE_TIME",
                            });
                          }}
                        >
                          <option value="EDC — One Time Charge">EDC — One Time Charge</option>
                          <option value="EDC — Rent (Monthly Charge)">EDC — Rent (Monthly Charge)</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input font-semibold"
                          value={item.spec_type || ""}
                          placeholder="misal: abc / 2/16/18"
                          onChange={(e) => handleFieldChange(actualIdx, "spec_type", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input tbl-input-center text-muted"
                          value={`${item.tier_min_qty || 1}–${item.tier_max_qty || 200}`}
                          onChange={(e) => {
                            const parts = e.target.value.split(/[-–]/);
                            const patch = {};
                            if (parts[0]) patch.tier_min_qty = parseInt(parts[0], 10) || 1;
                            if (parts[1]) patch.tier_max_qty = parseInt(parts[1], 10) || 200;
                            handleFieldChange(actualIdx, patch);
                          }}
                        />
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          value={item.selling_price || ""}
                          onChange={(e) => handleFieldChange(actualIdx, "selling_price", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <input
                            type="number"
                            step="0.1"
                            className="tbl-input tbl-input-center"
                            style={{ width: "55px" }}
                            value={item.referral_fee_pct ?? 5}
                            onChange={(e) => handleFieldChange(actualIdx, "referral_fee_pct", e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="tbl-td-right font-mono font-semibold text-accent">
                        {fmtRupiah.format(item._feePerUnit || 0)}
                      </td>
                      <td className="tbl-td-center">
                        <input
                          type="number"
                          className="tbl-input tbl-input-center"
                          style={{ width: "70px" }}
                          value={item.simulation_qty || 200}
                          onChange={(e) => handleFieldChange(actualIdx, "simulation_qty", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-right font-mono font-bold text-success" style={{ fontSize: "14px" }}>
                        {fmtRupiah.format(item._totalFee || 0)}
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
                            const desc = item.spec_type
                              ? `"${item.kategori} (${item.spec_type})"`
                              : `"${item.kategori || "produk ini"}"`;
                            if (window.confirm(`Apakah Anda yakin ingin menghapus data EDC ${desc}?`)) {
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
              Menampilkan {startIndex + 1}–{Math.min(startIndex + effectivePageSize, totalFilteredRows)} dari {totalFilteredRows} item
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
            + Tambah EDC
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

      {/* Add Item Modal */}
      {isAddOpen && (
        <div className="universal-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div
            className="universal-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "560px" }}
          >
            <div className="universal-modal-header">
              <h3 className="universal-modal-title">Tambah Produk EDC Baru</h3>
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
                <label>Skema Transaksi:</label>
                <select
                  className="tbl-select-cat"
                  value={newRow.kategori}
                  onChange={(e) => {
                    const k = e.target.value;
                    setNewRow((prev) => ({
                      ...prev,
                      kategori: k,
                      tipe_transaksi: k.includes("Rent") ? "MONTHLY_RENT" : "ONE_TIME",
                      selling_price: k.includes("Rent") ? 250000 : 2875000,
                    }));
                  }}
                >
                  <option value="EDC — One Time Charge">EDC — One Time Charge (Sekali Bayar)</option>
                  <option value="EDC — Rent (Monthly Charge)">EDC — Rent (Sewa Bulanan)</option>
                </select>
              </div>

              <div className="modal-form-group">
                <label>Spec Type:</label>
                <input
                  type="text"
                  className="tbl-input font-semibold"
                  placeholder="Contoh: abc atau 2/16/18"
                  value={newRow.spec_type}
                  onChange={(e) => setNewRow({ ...newRow, spec_type: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Tier Quantity:</label>
                  <input
                    type="text"
                    className="tbl-input"
                    placeholder="1–200"
                    value={`${newRow.tier_min_qty}–${newRow.tier_max_qty}`}
                    onChange={(e) => {
                      const p = e.target.value.split(/[-–]/);
                      setNewRow({
                        ...newRow,
                        tier_min_qty: parseInt(p[0], 10) || 1,
                        tier_max_qty: parseInt(p[1], 10) || 200,
                      });
                    }}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Selling Price (Rp):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    value={newRow.selling_price}
                    onChange={(e) => setNewRow({ ...newRow, selling_price: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Referral Fee (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    className="tbl-input"
                    value={newRow.referral_fee_pct}
                    onChange={(e) => setNewRow({ ...newRow, referral_fee_pct: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Simulasi Quantity:</label>
                  <input
                    type="number"
                    className="tbl-input"
                    value={newRow.simulation_qty}
                    onChange={(e) => setNewRow({ ...newRow, simulation_qty: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <label>Remarks / Catatan:</label>
                <input
                  type="text"
                  className="tbl-input"
                  placeholder="Catatan tambahan (opsional)"
                  value={newRow.remarks}
                  onChange={(e) => setNewRow({ ...newRow, remarks: e.target.value })}
                />
              </div>

              {/* Calculated preview in Add Modal */}
              <div className="modal-calc-preview">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span>Fee per Unit:</span>
                  <strong>
                    {fmtRupiah.format(
                      Math.round(
                        (parseFloat(newRow.selling_price) || 0) *
                          ((parseFloat(newRow.referral_fee_pct) || 0) / 100)
                      )
                    )}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Referral Fee:</span>
                  <strong className="text-success" style={{ fontSize: "16px" }}>
                    {fmtRupiah.format(
                      Math.round(
                        (parseFloat(newRow.selling_price) || 0) *
                          ((parseFloat(newRow.referral_fee_pct) || 0) / 100)
                      ) * (parseInt(newRow.simulation_qty, 10) || 1)
                    )}
                  </strong>
                </div>
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
                Simpan EDC
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
