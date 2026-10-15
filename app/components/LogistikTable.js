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

export default function LogistikTable({
  items = [],
  onUpdate,
  onDelete,
  onAdd,
  onBatchUpdate,
  productType = "logistik",
  onChangeProductType,
  typeCounts = {},
}) {
  const [selectedOrigin, setSelectedOrigin] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Interactive Cek Ongkir Simulator State
  const [simOrigin, setSimOrigin] = useState("");
  const [simDest, setSimDest] = useState("");
  const [simWeight, setSimWeight] = useState(1);

  // Add Route Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({
    origin_city_code: "ABU",
    origin_city: "ATAMBUA",
    destination_city_code: "ABU",
    destination_city: "ATAMBUA",
    service_type: "package",
    product_name: "REGPACK",
    start_weight: 1,
    end_weight: 1000,
    rate_type: "per_kg",
    range_type: "CHARGEABLE_weight",
    publish_rate: "",
    markup_percentage: 40,
    remarks: "",
  });

  const typeConfig = getProductTypeConfig(productType);

  // Enriched items with selling rate calculation
  const enrichedItems = useMemo(() => {
    return items.map((item, originalIndex) => {
      const pRate =
        item.publish_rate !== null && item.publish_rate !== "" && !isNaN(parseFloat(item.publish_rate))
          ? parseFloat(item.publish_rate)
          : null;
      const mPct = parseFloat(item.markup_percentage) || 40;

      let sRate = null;
      if (pRate !== null && pRate > 0) {
        sRate = Math.round(pRate * (1 + mPct / 100));
      }

      return {
        ...item,
        _originalIndex: originalIndex,
        _pRate: pRate,
        _sRate: sRate,
        _mPct: mPct,
      };
    });
  }, [items]);

  // Distinct cities list for filter & simulator
  const distinctCities = useMemo(() => {
    const origins = new Set();
    const dests = new Set();
    enrichedItems.forEach((r) => {
      if (r.origin_city) origins.add(r.origin_city.trim().toUpperCase());
      if (r.destination_city) dests.add(r.destination_city.trim().toUpperCase());
    });
    return {
      origins: Array.from(origins).sort(),
      destinations: Array.from(dests).sort(),
    };
  }, [enrichedItems]);

  // Set default simulator cities if empty
  useMemo(() => {
    if (!simOrigin && distinctCities.origins.length > 0) {
      setSimOrigin(distinctCities.origins[0]);
    }
    if (!simDest && distinctCities.destinations.length > 0) {
      setSimDest(distinctCities.destinations[0]);
    }
  }, [distinctCities, simOrigin, simDest]);

  // Simulator calculation
  const simResult = useMemo(() => {
    if (!simOrigin || !simDest) return null;
    const weight = parseFloat(simWeight) || 1;

    // Find matching route
    const match = enrichedItems.find(
      (r) =>
        r.origin_city?.trim().toUpperCase() === simOrigin.toUpperCase() &&
        r.destination_city?.trim().toUpperCase() === simDest.toUpperCase() &&
        weight >= (r.start_weight || 0) &&
        weight <= (r.end_weight || 999999)
    );

    if (!match) {
      return { found: false, message: "Rute pengiriman belum terdaftar di database." };
    }

    if (match._pRate === null) {
      return {
        found: true,
        match,
        hasPrice: false,
        message: "Publish rate belum diisi untuk rute ini di database.",
      };
    }

    const ratePerKg = match._sRate || Math.round(match._pRate * (1 + match._mPct / 100));
    const totalCost = ratePerKg * weight;

    return {
      found: true,
      hasPrice: true,
      match,
      weight,
      publishRate: match._pRate,
      markupPct: match._mPct,
      sellingRatePerKg: ratePerKg,
      totalCost,
    };
  }, [simOrigin, simDest, simWeight, enrichedItems]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let filledRates = 0;
    enrichedItems.forEach((item) => {
      if (item._pRate !== null) filledRates++;
    });

    return {
      totalRoutes: enrichedItems.length,
      filledRates,
      emptyRates: enrichedItems.length - filledRates,
      uniqueOrigins: distinctCities.origins.length,
      uniqueDests: distinctCities.destinations.length,
    };
  }, [enrichedItems, distinctCities]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      if (selectedOrigin !== "ALL") {
        if (item.origin_city?.trim().toUpperCase() !== selectedOrigin.toUpperCase()) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const oCity = String(item.origin_city || "").toLowerCase();
        const dCity = String(item.destination_city || "").toLowerCase();
        const oCode = String(item.origin_city_code || "").toLowerCase();
        const dCode = String(item.destination_city_code || "").toLowerCase();
        const prod = String(item.product_name || "").toLowerCase();
        const remarks = String(item.remarks || "").toLowerCase();
        if (
          !oCity.includes(term) &&
          !dCity.includes(term) &&
          !oCode.includes(term) &&
          !dCode.includes(term) &&
          !prod.includes(term) &&
          !remarks.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedItems, selectedOrigin, searchTerm]);

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

    // Auto-calculate selling rate when publish_rate or markup_percentage changes
    if ("publish_rate" in patch || "markup_percentage" in patch) {
      const p =
        updated.publish_rate !== "" && updated.publish_rate !== null ? parseFloat(updated.publish_rate) : null;
      const m = parseFloat(updated.markup_percentage) || 40;
      if (p !== null && p > 0) {
        updated.selling_rate = Math.round(p * (1 + m / 100));
      } else {
        updated.selling_rate = null;
      }
    }

    onUpdate(originalIndex, updated);
  };

  // Add Item
  const handleSaveNew = () => {
    if (!newRow.origin_city.trim() || !newRow.destination_city.trim()) {
      alert("Kota Asal dan Kota Tujuan wajib diisi.");
      return;
    }

    const p = newRow.publish_rate !== "" && newRow.publish_rate !== null ? parseFloat(newRow.publish_rate) : null;
    const m = parseFloat(newRow.markup_percentage) || 40;
    let s = null;
    if (p !== null && p > 0) {
      s = Math.round(p * (1 + m / 100));
    }

    const itemToSave = {
      ...newRow,
      kategori: newRow.product_name || "REGPACK",
      publish_rate: p,
      markup_percentage: m,
      selling_rate: s,
    };

    onAdd(itemToSave);
    setIsAddOpen(false);
    setNewRow({
      origin_city_code: "ABU",
      origin_city: "ATAMBUA",
      destination_city_code: "ABU",
      destination_city: "ATAMBUA",
      service_type: "package",
      product_name: "REGPACK",
      start_weight: 1,
      end_weight: 1000,
      rate_type: "per_kg",
      range_type: "CHARGEABLE_weight",
      publish_rate: "",
      markup_percentage: 40,
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
        "Kode Asal",
        "Kota Asal",
        "Kode Tujuan",
        "Kota Tujuan",
        "Jenis Layanan",
        "Nama Produk",
        "Rentang Berat (kg)",
        "Tipe Tarif",
        "Range Type",
        "Publish Rate (Rp)",
        "Markup (%)",
        "Selling Rate (Rp)",
        "Remarks",
      ];

      const dataRows = filteredItems.map((item, idx) => [
        idx + 1,
        item.origin_city_code || "-",
        item.origin_city || "-",
        item.destination_city_code || "-",
        item.destination_city || "-",
        item.service_type || "-",
        item.product_name || "-",
        `${item.start_weight}–${item.end_weight}`,
        item.rate_type || "per_kg",
        item.range_type || "-",
        item._pRate !== null ? item._pRate : "-",
        `${item._mPct}%`,
        item._sRate !== null ? item._sRate : "-",
        item.remarks || "-",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Logistik");
      XLSX.writeFile(wb, `Tarif_Logistik_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel Logistik:", err);
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
        "origin_city_code",
        "origin_city",
        "destination_city_code",
        "destination_city",
        "service_type",
        "product_name",
        "start_weight",
        "end_weight",
        "rate_type",
        "range_type",
        "publish_rate",
        "markup_percentage",
        "selling_rate",
        "remarks",
      ];
      const dataRows = filteredItems.map((item) => [
        item.origin_city_code || "",
        item.origin_city || "",
        item.destination_city_code || "",
        item.destination_city || "",
        item.service_type || "",
        item.product_name || "",
        item.start_weight || 1,
        item.end_weight || 1000,
        item.rate_type || "per_kg",
        item.range_type || "CHARGEABLE_weight",
        item._pRate !== null ? item._pRate : "",
        item._mPct || 40,
        item._sRate !== null ? item._sRate : "",
        item.remarks || "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tarif_Logistik_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal export CSV Logistik:", err);
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
                  ? `${filteredItems.length} dari ${items.length} rute`
                  : `${items.length} rute`}
              </span>
            </h2>
          </div>

          <span className="product-header-hint">
            Kalkulator Logistik & Pengiriman — Rute asal/tujuan, publish rate, dan markup jual otomatis
          </span>
        </div>

        {/* Interactive Cek Ongkir Banner */}
        <div className="ongkir-calc-card">
          <div className="ongkir-calc-header">
            <span className="ongkir-calc-title">Simulasi Cek Tarif Pengiriman</span>
            <span className="ongkir-calc-sub">
              Hitung otomatis tarif jual berdasarkan kota asal, kota tujuan, dan berat paket
            </span>
          </div>

          <div className="ongkir-calc-inputs">
            <div className="ongkir-input-group">
              <label>Kota Asal:</label>
              <select
                className="tbl-select-cat"
                value={simOrigin}
                onChange={(e) => setSimOrigin(e.target.value)}
              >
                {distinctCities.origins.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className="ongkir-input-group">
              <label>Kota Tujuan:</label>
              <select
                className="tbl-select-cat"
                value={simDest}
                onChange={(e) => setSimDest(e.target.value)}
              >
                {distinctCities.destinations.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className="ongkir-input-group" style={{ maxWidth: "120px" }}>
              <label>Berat (Kg):</label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                className="tbl-input tbl-input-center font-bold"
                value={simWeight}
                onChange={(e) => setSimWeight(Math.max(0.1, parseFloat(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Simulator Result Output */}
          <div className="ongkir-calc-result">
            {simResult?.found && simResult.hasPrice ? (
              <div className="ongkir-result-box success">
                <div className="ongkir-result-left">
                  <div className="ongkir-route-label">
                    {simOrigin} → {simDest} ({simResult.match.product_name || "REGPACK"})
                  </div>
                  <div className="ongkir-breakdown">
                    Publish Rate: <strong>{fmtRupiah.format(simResult.publishRate)}</strong> /kg &bull;
                    Markup: <strong>{simResult.markupPct}%</strong> &bull;
                    Tarif Jual: <strong>{fmtRupiah.format(simResult.sellingRatePerKg)}</strong> /kg
                  </div>
                </div>
                <div className="ongkir-result-right">
                  <span className="ongkir-total-label">Total Ongkos Kirim ({simWeight} kg):</span>
                  <span className="ongkir-total-value">{fmtRupiah.format(simResult.totalCost)}</span>
                </div>
              </div>
            ) : simResult?.found && !simResult.hasPrice ? (
              <div className="ongkir-result-box warning">
                Rute <strong>{simOrigin} → {simDest}</strong> terdaftar, namun <strong>Publish Rate</strong> masih kosong di database.
              </div>
            ) : (
              <div className="ongkir-result-box info">
                {simResult?.message || "Pilih kota asal dan tujuan untuk melihat estimasi ongkir."}
              </div>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="kpi-summary-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total Rute Logistik</span>
            <span className="kpi-value text-accent">{kpis.totalRoutes} Rute</span>
            <span className="kpi-sub">
              {kpis.uniqueOrigins} Kota Asal &bull; {kpis.uniqueDests} Kota Tujuan
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Kelengkapan Tarif Dasar</span>
            <span className="kpi-value text-success">{kpis.filledRates} Terisi</span>
            <span className="kpi-sub">
              {kpis.emptyRates > 0
                ? `${kpis.emptyRates} rute publish rate kosong (tidak diasumsikan 0)`
                : "Semua publish rate terisi"}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Aturan Markup Pengiriman</span>
            <span className="kpi-value">Selling Rate = Rate &times; (1 + M%)</span>
            <span className="kpi-sub">Default Markup Logistik: 40%</span>
          </div>
        </div>

        {/* Filter and Action Bar */}
        <div className="category-filter-wrapper">
          <div className="category-filter-top">
            <div className="category-filter-left">
              <label htmlFor="logistikOriginSelect" className="category-filter-label">
                Kota Asal:
              </label>
              <div className="category-select-wrapper">
                <select
                  id="logistikOriginSelect"
                  className="category-filter-select"
                  value={selectedOrigin}
                  onChange={(e) => {
                    setSelectedOrigin(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">Semua Kota Asal ({enrichedItems.length})</option>
                  {distinctCities.origins.map((origin) => (
                    <option key={origin} value={origin}>
                      {origin}
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
                  placeholder="Cari Kota / Kode / Layanan..."
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
          <table className="calc-table logistik-table">
            <thead>
              <tr className="tbl-header-top">
                <th className="tbl-th-center" style={{ width: "45px" }}>No</th>
                <th style={{ minWidth: "160px" }}>Kota Asal (Origin)</th>
                <th style={{ minWidth: "160px" }}>Kota Tujuan (Destination)</th>
                <th style={{ minWidth: "110px" }}>Layanan</th>
                <th style={{ minWidth: "110px" }}>Produk</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Berat (kg)</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Tipe Tarif</th>
                <th className="tbl-th-right" style={{ minWidth: "130px" }}>Publish Rate</th>
                <th className="tbl-th-center" style={{ minWidth: "90px" }}>Markup (%)</th>
                <th className="tbl-th-right" style={{ minWidth: "140px" }}>Selling Rate</th>
                <th style={{ minWidth: "120px" }}>Remarks</th>
                <th className="tbl-th-center" style={{ width: "60px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="12" className="tbl-empty-cell">
                    Belum ada data Rute Logistik. Klik "+ Tambah Rute" atau "Upload Massal".
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const actualIdx = item._originalIndex;

                  return (
                    <tr key={item.id || actualIdx} className="tbl-row">
                      <td className="tbl-td-center text-muted">{startIndex + idx + 1}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <input
                            type="text"
                            className="tbl-input tbl-input-center text-muted font-mono"
                            style={{ width: "48px" }}
                            value={item.origin_city_code || ""}
                            placeholder="KODE"
                            onChange={(e) => handleFieldChange(actualIdx, "origin_city_code", e.target.value.toUpperCase())}
                          />
                          <input
                            type="text"
                            className="tbl-input font-semibold"
                            value={item.origin_city || ""}
                            placeholder="Kota Asal..."
                            onChange={(e) => handleFieldChange(actualIdx, "origin_city", e.target.value.toUpperCase())}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <input
                            type="text"
                            className="tbl-input tbl-input-center text-muted font-mono"
                            style={{ width: "48px" }}
                            value={item.destination_city_code || ""}
                            placeholder="KODE"
                            onChange={(e) => handleFieldChange(actualIdx, "destination_city_code", e.target.value.toUpperCase())}
                          />
                          <input
                            type="text"
                            className="tbl-input font-semibold"
                            value={item.destination_city || ""}
                            placeholder="Kota Tujuan..."
                            onChange={(e) => handleFieldChange(actualIdx, "destination_city", e.target.value.toUpperCase())}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input"
                          style={{ width: "90px" }}
                          value={item.service_type || "package"}
                          onChange={(e) => handleFieldChange(actualIdx, "service_type", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="tbl-input font-semibold"
                          style={{ width: "90px" }}
                          value={item.product_name || "REGPACK"}
                          onChange={(e) => handleFieldChange(actualIdx, "product_name", e.target.value)}
                        />
                      </td>
                      <td className="tbl-td-center">
                        <input
                          type="text"
                          className="tbl-input tbl-input-center text-muted"
                          style={{ width: "70px" }}
                          value={`${item.start_weight || 1}–${item.end_weight || 1000}`}
                          onChange={(e) => {
                            const parts = e.target.value.split(/[-–]/);
                            const patch = {};
                            if (parts[0]) patch.start_weight = parseFloat(parts[0]) || 1;
                            if (parts[1]) patch.end_weight = parseFloat(parts[1]) || 1000;
                            handleFieldChange(actualIdx, patch);
                          }}
                        />
                      </td>
                      <td className="tbl-td-center text-muted font-mono" style={{ fontSize: "12px" }}>
                        {item.rate_type || "per_kg"}
                      </td>
                      <td className="tbl-td-right">
                        <input
                          type="number"
                          className="tbl-input tbl-input-right"
                          placeholder="-"
                          value={item._pRate !== null ? item._pRate : ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseFloat(e.target.value);
                            handleFieldChange(actualIdx, "publish_rate", val);
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
                            value={item.markup_percentage ?? 40}
                            onChange={(e) => handleFieldChange(actualIdx, "markup_percentage", e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="tbl-td-right font-mono font-bold text-accent" style={{ fontSize: "14px" }}>
                        {item._sRate !== null ? fmtRupiah.format(item._sRate) : <span className="text-muted">-</span>}
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
                          onClick={() => onDelete && onDelete(actualIdx)}
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
              Menampilkan {startIndex + 1}–{Math.min(startIndex + effectivePageSize, totalFilteredRows)} dari {totalFilteredRows} rute
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
            + Tambah Rute
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

      {/* Add Route Modal */}
      {isAddOpen && (
        <div className="universal-modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div
            className="universal-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="universal-modal-header">
              <h3 className="universal-modal-title">Tambah Rute Logistik Baru</h3>
              <button
                type="button"
                className="universal-modal-close"
                onClick={() => setIsAddOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="universal-modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Kota Asal (Origin):</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="tbl-input"
                      style={{ width: "65px" }}
                      placeholder="KODE"
                      value={newRow.origin_city_code}
                      onChange={(e) =>
                        setNewRow({ ...newRow, origin_city_code: e.target.value.toUpperCase() })
                      }
                    />
                    <input
                      type="text"
                      className="tbl-input font-semibold"
                      placeholder="Nama Kota Asal"
                      value={newRow.origin_city}
                      onChange={(e) =>
                        setNewRow({ ...newRow, origin_city: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>

                <div className="modal-form-group">
                  <label>Kota Tujuan (Destination):</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="tbl-input"
                      style={{ width: "65px" }}
                      placeholder="KODE"
                      value={newRow.destination_city_code}
                      onChange={(e) =>
                        setNewRow({ ...newRow, destination_city_code: e.target.value.toUpperCase() })
                      }
                    />
                    <input
                      type="text"
                      className="tbl-input font-semibold"
                      placeholder="Nama Kota Tujuan"
                      value={newRow.destination_city}
                      onChange={(e) =>
                        setNewRow({ ...newRow, destination_city: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div className="modal-form-group">
                  <label>Jenis Layanan:</label>
                  <input
                    type="text"
                    className="tbl-input"
                    value={newRow.service_type}
                    onChange={(e) => setNewRow({ ...newRow, service_type: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Nama Produk:</label>
                  <input
                    type="text"
                    className="tbl-input font-semibold"
                    value={newRow.product_name}
                    onChange={(e) => setNewRow({ ...newRow, product_name: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Rentang Berat (kg):</label>
                  <input
                    type="text"
                    className="tbl-input tbl-input-center"
                    placeholder="1–1000"
                    value={`${newRow.start_weight}–${newRow.end_weight}`}
                    onChange={(e) => {
                      const p = e.target.value.split(/[-–]/);
                      setNewRow({
                        ...newRow,
                        start_weight: parseFloat(p[0]) || 1,
                        end_weight: parseFloat(p[1]) || 1000,
                      });
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="modal-form-group">
                  <label>Publish Rate (Rp / kg):</label>
                  <input
                    type="number"
                    className="tbl-input"
                    placeholder="Kosongkan jika belum ada tarif"
                    value={newRow.publish_rate}
                    onChange={(e) => setNewRow({ ...newRow, publish_rate: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Markup (%):</label>
                  <input
                    type="number"
                    step="0.5"
                    className="tbl-input"
                    value={newRow.markup_percentage}
                    onChange={(e) => setNewRow({ ...newRow, markup_percentage: e.target.value })}
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
                {newRow.publish_rate !== "" && !isNaN(parseFloat(newRow.publish_rate)) ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Estimasi Selling Rate:</span>
                    <strong className="text-accent" style={{ fontSize: "16px" }}>
                      {fmtRupiah.format(
                        Math.round(
                          parseFloat(newRow.publish_rate) *
                            (1 + (parseFloat(newRow.markup_percentage) || 40) / 100)
                        )
                      )}{" "}
                      / kg
                    </strong>
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontStyle: "italic" }}>
                    Publish rate belum diisi. Tarif jual akan berstatus belum ada tarif tanpa mengasumsikan nol.
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
                Simpan Rute Logistik
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
