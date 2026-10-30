"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

const fmtRupiah = (val) => {
  if (val === null || val === undefined || val === "" || isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function ExportPackageModal({
  isOpen,
  onClose,
  items = [],
  initialSelectedItems = null,
  availableCategories = [],
  format = "excel", // "excel" | "csv"
  onExport,
}) {
  const [activeFormat, setActiveFormat] = useState(format);
  const [layout, setLayout] = useState("matrix"); // "matrix" | "grouped" | "flat"
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStock, setSelectedStock] = useState("ALL"); // "ALL" | "OPEN" | "CLOSED"
  const [selectedIds, setSelectedIds] = useState(() => {
    const source = initialSelectedItems && initialSelectedItems.length > 0 ? initialSelectedItems : items;
    const ids = new Set();
    source.forEach((item, idx) => {
      const isArr = Array.isArray(item);
      const originalIndex = item._originalIndex !== undefined ? item._originalIndex : idx;
      const id = isArr ? (item[5] ?? `row-${originalIndex}`) : (item.id ?? `row-${originalIndex}`);
      ids.add(String(id));
    });
    return ids;
  });
  const searchInputRef = useRef(null);

  // Normalize items to consistent structure
  const normalizedItems = useMemo(() => {
    return items.map((item, idx) => {
      const isArr = Array.isArray(item);
      const originalIndex = item._originalIndex !== undefined ? item._originalIndex : idx;
      const id = isArr ? (item[5] ?? `row-${originalIndex}`) : (item.id ?? `row-${originalIndex}`);
      const name = isArr ? (item[2] || `Paket #${idx + 1}`) : (item.nama_produk || item.tipe_cloudsim || item.spec_type || `Item #${idx + 1}`);
      const provider = isArr ? (item[0] || "-") : (item.provider || item.jenis_transaksi || "-");
      const stock = isArr
        ? String(item[1] || "-").trim().toUpperCase()
        : String(item.status_stok || item.stock || "-").trim().toUpperCase();
      const quota = isArr ? (item[3] !== undefined && item[3] !== null && item[3] !== "" ? `${item[3]} GB` : "-") : (item.package_quota_gb ? `${item.package_quota_gb} GB` : "-");
      const cogs = isArr ? (typeof item[4] === "number" ? item[4] : parseFloat(item[4]) || 0) : (item.cogs || item.cogs_cku || 0);
      const category = isArr ? (item[6] || "") : (item.kategori || "");

      return {
        id: String(id),
        index: originalIndex,
        name,
        provider,
        stock,
        quota,
        cogs,
        category,
        raw: item,
      };
    });
  }, [items]);

  // Stock status counts
  const stockCounts = useMemo(() => {
    let open = 0;
    let closed = 0;
    normalizedItems.forEach((item) => {
      const s = String(item.stock || "").trim().toUpperCase();
      if (s === "OPEN") open++;
      else if (s === "CLOSED") closed++;
    });
    return { ALL: normalizedItems.length, OPEN: open, CLOSED: closed };
  }, [normalizedItems]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Filtered items based on search, category, and stock status
  const filteredItems = useMemo(() => {
    return normalizedItems.filter((item) => {
      // Stock status filter (OPEN / CLOSED)
      if (selectedStock !== "ALL") {
        const s = String(item.stock || "").trim().toUpperCase();
        if (selectedStock === "OPEN" && s !== "OPEN") return false;
        if (selectedStock === "CLOSED" && s !== "CLOSED") return false;
      }

      // Category filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "NONE") {
          if (item.category.trim() !== "") return false;
        } else if (item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(term);
        const matchProvider = item.provider.toLowerCase().includes(term);
        const matchCategory = item.category.toLowerCase().includes(term);
        const matchQuota = item.quota.toLowerCase().includes(term);
        const matchStock = item.stock.toLowerCase().includes(term);
        if (!matchName && !matchProvider && !matchCategory && !matchQuota && !matchStock) return false;
      }

      return true;
    });
  }, [normalizedItems, searchTerm, selectedCategory, selectedStock]);

  if (!isOpen) return null;

  // Toggle single item
  const handleToggleItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all filtered items
  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  };

  // Select only items matching a specific stock status
  const handleSelectOnlyStock = (status) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      normalizedItems.forEach((item) => {
        const s = String(item.stock || "").trim().toUpperCase();
        if (s === status) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  };

  // Deselect all filtered items
  const handleDeselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((item) => next.delete(item.id));
      return next;
    });
  };

  // Deselect entire selection
  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  // Master checkbox status for visible items
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const someFilteredSelected = filteredItems.some((item) => selectedIds.has(item.id));

  const handleMasterCheckboxChange = () => {
    if (allFilteredSelected) {
      handleDeselectAllFiltered();
    } else {
      handleSelectAllFiltered();
    }
  };

  // Submit export
  const handleConfirmExport = () => {
    const selectedRows = normalizedItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.raw);

    if (selectedRows.length === 0) return;
    if (onExport) {
      onExport(selectedRows, activeFormat, layout);
    }
  };

  const selectedCount = selectedIds.size;
  const isExcel = activeFormat === "excel";

  return (
    <div
      className="universal-modal-overlay export-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exportModalTitle"
    >
      <div
        className="universal-modal-dialog export-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "820px" }}
      >
        {/* Header */}
        <div className="universal-modal-header export-modal-header">
          <div>
            <h3 id="exportModalTitle" className="universal-modal-title">
              Pilih Paket untuk Download {isExcel ? "Excel" : "CSV"}
            </h3>
            <p className="universal-modal-sub">
              Pilih paket mana saja yang ingin diexport agar file spreadsheet rapi dan tepat sasaran.
            </p>
          </div>
          <button
            type="button"
            className="universal-modal-close"
            onClick={onClose}
            aria-label="Tutup jendela export"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="universal-modal-body export-modal-body" style={{ padding: "18px 24px" }}>
          {/* Format Switcher & Toolbar */}
          <div className="export-toolbar-row">
            {/* Format toggle pills */}
            <div className="export-format-pills" role="radiogroup" aria-label="Format File">
              <button
                type="button"
                className={`export-format-pill ${isExcel ? "active" : ""}`}
                onClick={() => setActiveFormat("excel")}
              >
                Excel (.xlsx)
              </button>
              <button
                type="button"
                className={`export-format-pill ${!isExcel ? "active" : ""}`}
                onClick={() => setActiveFormat("csv")}
              >
                CSV (.csv)
              </button>
            </div>

            {/* Layout selector pills */}
            <div className="export-layout-pills" role="radiogroup" aria-label="Tata Letak Susunan Harga">
              <button
                type="button"
                className={`export-layout-pill ${layout === "matrix" ? "active" : ""}`}
                onClick={() => setLayout("matrix")}
                title="Nama paket horizontal ke kanan, daftar harga vertikal ke bawah (seperti contoh)"
              >
                Matrix (Paket ke Kanan, Harga ke Bawah)
              </button>
              <button
                type="button"
                className={`export-layout-pill ${layout === "grouped" ? "active" : ""}`}
                onClick={() => setLayout("grouped")}
                title="Setiap paket terpisah dalam daftar bertingkat ke bawah"
              >
                List per Paket
              </button>
              <button
                type="button"
                className={`export-layout-pill ${layout === "flat" ? "active" : ""}`}
                onClick={() => setLayout("flat")}
                title="Semua kolom sejajar dalam satu baris (pivot/flat)"
              >
                Tabel Sejajar
              </button>
            </div>
          </div>

          {/* Search bar & filter controls */}
          <div className="export-filter-bar">
            <div className="export-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="tbl-input export-search-input"
                placeholder="Cari nama paket, penyedia, kuota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm("")}
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Status Stok (OPEN / CLOSED) */}
            {(stockCounts.OPEN > 0 || stockCounts.CLOSED > 0) && (
              <div className="export-stock-pills" role="radiogroup" aria-label="Filter Status Stok">
                <button
                  type="button"
                  className={`export-stock-pill ${selectedStock === "ALL" ? "active" : ""}`}
                  onClick={() => setSelectedStock("ALL")}
                  title="Tampilkan semua paket tanpa filter stok"
                >
                  Semua ({stockCounts.ALL})
                </button>
                <button
                  type="button"
                  className={`export-stock-pill pill-open ${selectedStock === "OPEN" ? "active" : ""}`}
                  onClick={() => setSelectedStock("OPEN")}
                  title="Tampilkan hanya paket yang masih OPEN"
                >
                  OPEN ({stockCounts.OPEN})
                </button>
                <button
                  type="button"
                  className={`export-stock-pill pill-closed ${selectedStock === "CLOSED" ? "active" : ""}`}
                  onClick={() => setSelectedStock("CLOSED")}
                  title="Tampilkan paket yang sudah CLOSED"
                >
                  CLOSED ({stockCounts.CLOSED})
                </button>
              </div>
            )}

            {/* Category filter if available */}
            {availableCategories && availableCategories.length > 0 && (
              <div className="export-cat-filter">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="tbl-select-cat"
                  style={{ minWidth: "150px", height: "34px" }}
                  aria-label="Filter kategori paket"
                >
                  <option value="ALL">Semua Kategori</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.shortLabel || cat.label}
                    </option>
                  ))}
                  <option value="NONE">Tanpa Kategori</option>
                </select>
              </div>
            )}
          </div>

          {/* Quick Action Buttons Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "10px", flexWrap: "wrap" }}>
            <div className="export-action-btns">
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleSelectAllFiltered}
                title="Pilih semua paket yang sedang tampil di tabel"
              >
                Pilih Semua ({filteredItems.length})
              </button>
              {stockCounts.OPEN > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleSelectOnlyStock("OPEN")}
                  title="Pilih hanya paket dengan status OPEN"
                  style={{ borderColor: "rgba(16, 185, 129, 0.4)" }}
                >
                  Pilih OPEN Saja ({stockCounts.OPEN})
                </button>
              )}
              {stockCounts.CLOSED > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleSelectOnlyStock("CLOSED")}
                  title="Pilih hanya paket dengan status CLOSED"
                  style={{ borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  Pilih CLOSED Saja ({stockCounts.CLOSED})
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleClearAll}
                title="Batalkan seluruh centang pilihan"
              >
                Kosongkan
              </button>
            </div>

            <div className="export-counter-badge">
              Terpilih: <strong>{selectedCount}</strong> dari {normalizedItems.length} paket
            </div>
          </div>

          {/* Package Selection List / Table */}
          <div className="export-list-card">
            <table className="export-table">
              <thead>
                <tr>
                  <th style={{ width: "42px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="export-checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                      }}
                      onChange={handleMasterCheckboxChange}
                      aria-label="Pilih semua paket yang tampil"
                      title="Pilih / batal semua paket yang tampil"
                    />
                  </th>
                  <th style={{ width: "38px", textAlign: "center" }}>No</th>
                  <th>Nama Paket / Provider</th>
                  {(stockCounts.OPEN > 0 || stockCounts.CLOSED > 0) && (
                    <th style={{ width: "95px", textAlign: "center" }}>Status Stok</th>
                  )}
                  <th style={{ width: "110px" }}>Penyedia</th>
                  <th style={{ width: "85px", textAlign: "right" }}>Kuota</th>
                  <th style={{ width: "120px", textAlign: "right" }}>COGS Modal</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(stockCounts.OPEN > 0 || stockCounts.CLOSED > 0) ? "7" : "6"}
                      className="export-empty-cell"
                    >
                      {searchTerm || selectedCategory !== "ALL" || selectedStock !== "ALL"
                        ? "Tidak ada paket yang cocok dengan filter atau kata kunci."
                        : "Belum ada paket produk yang tersedia."}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isChecked = selectedIds.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`export-row ${isChecked ? "is-selected" : ""}`}
                        onClick={() => handleToggleItem(item.id)}
                      >
                        <td
                          style={{ textAlign: "center" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="export-checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleItem(item.id)}
                            aria-label={`Pilih ${item.name}`}
                          />
                        </td>
                        <td style={{ textAlign: "center" }} className="text-muted">
                          {idx + 1}
                        </td>
                        <td>
                          <div className="export-item-title-wrap">
                            <span className="export-item-name">{item.name}</span>
                            {item.category && (
                              <span className="export-cat-badge">{item.category}</span>
                            )}
                          </div>
                        </td>
                        {(stockCounts.OPEN > 0 || stockCounts.CLOSED > 0) && (
                          <td style={{ textAlign: "center" }}>
                            {item.stock === "OPEN" ? (
                              <span className="badge-stock-open">OPEN</span>
                            ) : item.stock === "CLOSED" ? (
                              <span className="badge-stock-closed">CLOSED</span>
                            ) : (
                              <span className="text-muted">{item.stock || "-"}</span>
                            )}
                          </td>
                        )}
                        <td>
                          <span className="export-item-meta">{item.provider}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "600" }}>
                          {item.quota}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {fmtRupiah(item.cogs)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="universal-modal-footer export-modal-footer">
          <div className="export-footer-summary">
            {selectedCount > 0 ? (
              <span>
                <strong>{selectedCount} paket</strong> terpilih (format:{" "}
                <strong>
                  {layout === "matrix"
                    ? "Matrix (Paket ke Kanan, Harga ke Bawah)"
                    : layout === "grouped"
                    ? "List Bertingkat per Paket"
                    : "Tabel Sejajar"}
                </strong>).
              </span>
            ) : (
              <span className="text-muted">Pilih minimal 1 paket untuk mendownload file.</span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="button"
              className={`btn ${isExcel ? "btn-success" : "btn-primary"}`}
              onClick={handleConfirmExport}
              disabled={selectedCount === 0}
              style={{ minWidth: "180px", fontWeight: "600" }}
            >
              {isExcel
                ? `Download Excel (${selectedCount})`
                : `Download CSV (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
