"use client";

import { useMemo, useState } from "react";
import {
  calculatePrice,
  getProductTaxInfo,
  fmtNumber,
  fmtPercent,
} from "../lib/calculator";

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

      {/* Results injected via props */}
      <td className="col-price cell-price">{row._p1 ?? "-"}</td>
      <td className="col-margin cell-margin">
        {row._m1 !== undefined ? (
          <MarginBadge actual={row._m1} target={row._targetMargin1} />
        ) : (
          "-"
        )}
      </td>
      <td className="col-price cell-price">{row._p2 ?? "-"}</td>
      <td className="col-margin cell-margin">
        {row._m2 !== undefined ? (
          <MarginBadge actual={row._m2} target={row._targetMargin2} />
        ) : (
          "-"
        )}
      </td>
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
  margin1,
  margin2,
  qty1,
  qty2,
  error,
  taxEnabled = true,
  children,
}) {
  const enrichedData = useMemo(() => {
    const m1 = parseFloat(margin1) / 100;
    const m2 = parseFloat(margin2) / 100;

    return data.map((row) => {
      const rawCogs = row[4];
      const cogs = typeof rawCogs === "number" ? rawCogs : parseFloat(rawCogs);
      const enriched = [...row];
      enriched._targetMargin1 = m1;
      enriched._targetMargin2 = m2;

      const taxInfo = getProductTaxInfo(row[0], taxEnabled);
      enriched._taxInfo = taxInfo;

      if (!error && !isNaN(cogs) && cogs >= 0 && rawCogs !== "") {
        const a = calculatePrice(cogs, m1, taxInfo.totalRate);
        const b = calculatePrice(cogs, m2, taxInfo.totalRate);
        enriched._p1 = `Rp ${fmtNumber.format(a.price)}`;
        enriched._rawPrice1 = a.price;
        enriched._m1 = a.margin;
        enriched._p2 = `Rp ${fmtNumber.format(b.price)}`;
        enriched._rawPrice2 = b.price;
        enriched._m2 = b.margin;
        enriched._effectiveCogs = a.effectiveCogs;
        enriched._taxAmount = a.taxAmount;
      } else {
        enriched._p1 = "-";
        enriched._rawPrice1 = 0;
        enriched._m1 = undefined;
        enriched._p2 = "-";
        enriched._rawPrice2 = 0;
        enriched._m2 = undefined;
        enriched._effectiveCogs = undefined;
        enriched._taxAmount = undefined;
      }

      return enriched;
    });
  }, [data, margin1, margin2, error, taxEnabled]);

  const q1Label = isNaN(parseFloat(qty1))
    ? "-"
    : fmtNumber.format(parseFloat(qty1));
  const q2Label = isNaN(parseFloat(qty2))
    ? "-"
    : fmtNumber.format(parseFloat(qty2));

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

      headerRow.push(
        `Harga Jual (${q1Label} unit - Margin ${margin1}%)`,
        `Margin Aktual (${q1Label} unit)`,
        `Harga Jual (${q2Label} unit - Margin ${margin2}%)`,
        `Margin Aktual (${q2Label} unit)`
      );

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

        const p1Val = typeof row._rawPrice1 === "number" ? Math.round(row._rawPrice1) : 0;
        const m1Pct = row._m1 !== undefined && !isNaN(row._m1) ? `${(row._m1 * 100).toFixed(1)}%` : "-";
        const p2Val = typeof row._rawPrice2 === "number" ? Math.round(row._rawPrice2) : 0;
        const m2Pct = row._m2 !== undefined && !isNaN(row._m2) ? `${(row._m2 * 100).toFixed(1)}%` : "-";

        item.push(p1Val, m1Pct, p2Val, m2Pct);
        return item;
      });

      const ws = XLSX.utils.aoa_to_sheet([
        ["Kalkulator Harga Jual Paket Data"],
        [
          `Skenario 1: ${q1Label} unit (Margin ${margin1}%)`,
          `Skenario 2: ${q2Label} unit (Margin ${margin2}%)`,
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
        { wch: 24 },
        { wch: 16 },
        { wch: 24 },
        { wch: 16 },
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

      headerRow.push(
        `Harga Jual (${q1Label} unit - Margin ${margin1}%)`,
        `Margin Aktual (${q1Label} unit)`,
        `Harga Jual (${q2Label} unit - Margin ${margin2}%)`,
        `Margin Aktual (${q2Label} unit)`
      );

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

        const p1Val = typeof row._rawPrice1 === "number" ? Math.round(row._rawPrice1) : 0;
        const m1Pct = row._m1 !== undefined && !isNaN(row._m1) ? `${(row._m1 * 100).toFixed(1)}%` : "-";
        const p2Val = typeof row._rawPrice2 === "number" ? Math.round(row._rawPrice2) : 0;
        const m2Pct = row._m2 !== undefined && !isNaN(row._m2) ? `${(row._m2 * 100).toFixed(1)}%` : "-";

        item.push(p1Val, m1Pct, p2Val, m2Pct);
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

  return (
    <section className="card card-delay-2">
      <h2 className="card-title">Produk dan hasil</h2>

      {error && (
        <div className="error-alert" role="alert">
          {error}
        </div>
      )}

      <div className="table-scroll">
        <table className={taxEnabled ? "is-tax-active" : ""}>
          <thead>
            <tr className="header-group-row">
              <th colSpan={taxEnabled ? 7 : 5} className="group-header group-header-base">
                Data Produk {taxEnabled ? "& Modal (+Pajak)" : "& Modal"}
              </th>
              <th className="group-header group-header-s1" colSpan="2">
                Skenario 1 ({q1Label} unit · Margin {margin1}%)
              </th>
              <th className="group-header group-header-s2" colSpan="2">
                Skenario 2 ({q2Label} unit · Margin {margin2}%)
              </th>
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
                  <th className="col-price text-right">Harga Jual</th>
                  <th className="col-margin text-right">Margin</th>
                  <th className="col-price text-right">Harga Jual</th>
                  <th className="col-margin text-right">Margin</th>
                  <th className="col-action text-center"></th>
                </tr>
              </thead>
              <tbody>
                {enrichedData.map((row, i) => (
                  <ProductRow
                    key={i}
                    row={row}
                    index={i}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    taxEnabled={taxEnabled}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="button-bar">
            <button className="btn btn-primary" onClick={onAdd}>
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
