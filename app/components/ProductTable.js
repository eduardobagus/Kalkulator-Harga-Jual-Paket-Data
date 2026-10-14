"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  calculatePrice,
  getProductTaxInfo,
  fmtNumber,
  fmtPercent,
} from "../lib/calculator";

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
  // Toleransi pembulatan rupiah agar tidak memicu status peringatan semu
  const isLow = Math.round(actual * 1000) < Math.round(target * 1000);
  return (
    <span className={`badge ${isLow ? "badge-warning" : "badge-success"}`}>
      {fmtPercent.format(actual * 100)}%
    </span>
  );
}

function ProductRow({ row, index, onUpdate, onDelete, taxEnabled }) {
  const handleChange = (field, value) => {
    onUpdate(index, field, value);
  };

  return (
    <tr className="tbl-row">
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
  children,
}) {
  const parsedMargins = useMemo(
    () => margins.map((m) => parseFloat(m) / 100),
    [margins]
  );

  const enrichedData = useMemo(() => {
    return data.map((row, originalIndex) => {
      const rawCogs = row[4];
      const cogs = typeof rawCogs === "number" ? rawCogs : parseFloat(rawCogs);
      const enriched = [...row];
      enriched._originalIndex = originalIndex;

      const taxInfo = getProductTaxInfo(row[0], taxEnabled);
      enriched._taxInfo = taxInfo;

      for (let i = 0; i < NUM_SCENARIOS; i++) {
        enriched[`_targetMargin${i}`] = parsedMargins[i];

        if (!error && !isNaN(cogs) && cogs >= 0 && rawCogs !== "") {
          const result = calculatePrice(cogs, parsedMargins[i], taxInfo.totalRate);
          enriched[`_p${i}`] = `Rp ${fmtNumber.format(result.price)}`;
          enriched[`_rawPrice${i}`] = result.price;
          enriched[`_m${i}`] = result.margin;
          // Share effective COGS from first calc (same for all scenarios)
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
  }, [data, parsedMargins, error, taxEnabled]);

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

  const totalRows = enrichedData.length;
  const isAll = pageSize === "all";
  const effectivePageSize = isAll ? totalRows : Number(pageSize);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));

  // Reset page when out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const startIndex = isAll ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalRows : Math.min(startIndex + effectivePageSize, totalRows);
  const displayedRows = enrichedData.slice(startIndex, endIndex);

  // Helper when adding product so user lands on the new row's page
  const handleAddProduct = () => {
    onAdd();
    if (!isAll) {
      const newTotal = totalRows + 1;
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

      const dataRows = enrichedData.map((row, idx) => {
        const item = [
          idx + 1,
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
        ["Kalkulator Harga Jual Paket Data"],
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
        { wch: 14 },
        { wch: 14 },
        { wch: 34 },
        { wch: 14 },
        { wch: 16 },
        ...(taxEnabled ? [{ wch: 18 }, { wch: 18 }, { wch: 18 }] : []),
        ...Array.from({ length: NUM_SCENARIOS }, () => [{ wch: 24 }, { wch: 16 }]).flat(),
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Harga Jual Paket Data");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Harga_Jual_Paket_Data_${today}.xlsx`);
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

      const dataRows = enrichedData.map((row, idx) => {
        const item = [
          idx + 1,
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
      XLSX.writeFile(wb, `Harga_Jual_Paket_Data_${today}.csv`, { bookType: "csv" });
    } catch (err) {
      console.error("Gagal export CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const baseColCount = taxEnabled ? 7 : 5;

  return (
    <section className="card card-delay-2">
      <div className="table-header-flex">
        <h2 className="card-title">
          Produk dan hasil
          <span className="counter-badge">{totalRows} produk</span>
        </h2>
      </div>

      {error && (
        <div className="error-alert" role="alert">
          {error}
        </div>
      )}

      <div className="table-scroll">
        <table className={taxEnabled ? "is-tax-active" : ""}>
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
              <th className="col-penyedia text-center">Penyedia</th>
              <th className="col-stok">Stok</th>
              <th className="col-provider">Provider</th>
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
                  Belum ada data produk. Klik &quot;Tambah produk&quot; untuk menambahkan data.
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      <div className="table-pagination-bar">
        <div className="pagination-info">
          Menampilkan <strong>{totalRows > 0 ? startIndex + 1 : 0} - {endIndex}</strong> dari{" "}
          <strong>{totalRows}</strong> produk
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
          Tambah produk
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
