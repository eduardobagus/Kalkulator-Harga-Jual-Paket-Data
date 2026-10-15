"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  parseDelimitedFlexible,
  parseSimcardRows,
  parseEdcRows,
  parseRouterRows,
  parseCloudsimRows,
  parseLogistikRows,
} from "../lib/parsers";
import { downloadCsvTemplate } from "../lib/templates";
import { getProductTypeConfig } from "../lib/productTypes";

export default function UniversalImportModal({
  isOpen,
  onClose,
  productType = "simcard",
  onImport,
}) {
  const [activeTab, setActiveTab] = useState("file"); // 'file' | 'paste'
  const [pasteContent, setPasteContent] = useState("");
  const [replaceAll, setReplaceAll] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Excel workbook & sheet selection
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");

  // Parsed results for preview
  const [previewResult, setPreviewResult] = useState(null);
  // { added: [], errors: [], totalRawRows: 0, filename: "" }

  const fileInputRef = useRef(null);
  const typeConfig = getProductTypeConfig(productType);

  // Helper to parse 2D array of rows using the active product type parser
  const parseRowsWithActiveParser = useCallback(
    (rows, sourceName = "data") => {
      let result = { added: [], errors: [] };
      switch (productType) {
        case "edc_referral":
          result = parseEdcRows(rows);
          break;
        case "router":
          result = parseRouterRows(rows);
          break;
        case "cloudsim":
          result = parseCloudsimRows(rows);
          break;
        case "logistik":
          result = parseLogistikRows(rows);
          break;
        case "simcard":
        default:
          result = parseSimcardRows(rows);
          break;
      }

      setPreviewResult({
        added: result.added,
        errors: result.errors,
        totalRawRows: rows.length,
        sourceName,
      });
    },
    [productType]
  );

  // Process text content (CSV / TSV)
  const processTextData = useCallback(
    (text, sourceName = "Teks Tempel") => {
      try {
        const rows = parseDelimitedFlexible(text);
        if (!rows.length) {
          alert("Data kosong atau format teks tidak dapat dibaca.");
          return;
        }
        parseRowsWithActiveParser(rows, sourceName);
      } catch (err) {
        console.error("Gagal membaca teks CSV:", err);
        alert("Gagal memproses data teks: " + err.message);
      }
    },
    [parseRowsWithActiveParser]
  );

  // Handle uploaded file (.xlsx, .xls, .csv, .txt)
  const handleFileChange = useCallback(
    async (file) => {
      if (!file) return;
      setIsProcessing(true);
      const filename = file.name;
      const isCsvOrText = /\.(csv|txt)$/i.test(filename);

      try {
        if (isCsvOrText) {
          const reader = new FileReader();
          reader.onload = (e) => {
            processTextData(e.target.result, filename);
            setIsProcessing(false);
          };
          reader.onerror = () => {
            alert("Gagal membaca file CSV/TXT.");
            setIsProcessing(false);
          };
          reader.readAsText(file);
        } else {
          // XLSX / XLS file
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const XLSX = await import("xlsx");
              const wb = XLSX.read(e.target.result, { type: "array" });
              setWorkbook(wb);
              setSheetNames(wb.SheetNames || []);

              const firstSheetName = wb.SheetNames[0];
              setSelectedSheet(firstSheetName);

              const ws = wb.Sheets[firstSheetName];
              const rows = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                raw: true,
                defval: "",
              });

              parseRowsWithActiveParser(rows, `${filename} (${firstSheetName})`);
            } catch (err) {
              console.error("Gagal membaca Excel workbook:", err);
              alert("Gagal memproses file Excel: " + err.message);
            } finally {
              setIsProcessing(false);
            }
          };
          reader.onerror = () => {
            alert("Gagal membaca file Excel.");
            setIsProcessing(false);
          };
          reader.readAsArrayBuffer(file);
        }
      } catch (err) {
        console.error("Error file handling:", err);
        setIsProcessing(false);
      }
    },
    [processTextData, parseRowsWithActiveParser]
  );

  // Change selected Excel sheet
  const handleSheetChange = useCallback(
    async (newSheetName) => {
      if (!workbook || !workbook.Sheets[newSheetName]) return;
      setSelectedSheet(newSheetName);
      try {
        const XLSX = await import("xlsx");
        const ws = workbook.Sheets[newSheetName];
        const rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
          defval: "",
        });
        parseRowsWithActiveParser(rows, `Sheet: ${newSheetName}`);
      } catch (err) {
        console.error("Gagal berganti sheet:", err);
      }
    },
    [workbook, parseRowsWithActiveParser]
  );

  // Apply import
  const handleApplyImport = useCallback(() => {
    if (!previewResult || !previewResult.added.length) {
      alert("Tidak ada baris data valid untuk diimpor.");
      return;
    }

    onImport(previewResult.added, replaceAll);
    handleReset();
    if (onClose) onClose();
  }, [previewResult, replaceAll, onImport, onClose]);

  const handleReset = () => {
    setPreviewResult(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setPasteContent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="universal-modal-overlay" onClick={onClose}>
      <div
        className="universal-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="importModalTitle"
      >
        {/* Modal Header */}
        <div className="universal-modal-header">
          <div>
            <h3 id="importModalTitle" className="universal-modal-title">
              Upload Massal — {typeConfig.label}
            </h3>
            <p className="universal-modal-sub">
              Dukungan format .xlsx, .xls, .csv, angka Rupiah (1.600.000 / 1600000), persentase, dan rentang.
            </p>
          </div>
          <button
            type="button"
            className="universal-modal-close"
            onClick={onClose}
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="universal-modal-body">
          {/* Action & Template Bar */}
          <div className="import-action-bar">
            <div className="import-tabs">
              <button
                type="button"
                className={`import-tab-btn ${activeTab === "file" ? "active" : ""}`}
                onClick={() => setActiveTab("file")}
              >
                Pilih File Excel / CSV
              </button>
              <button
                type="button"
                className={`import-tab-btn ${activeTab === "paste" ? "active" : ""}`}
                onClick={() => setActiveTab("paste")}
              >
                Salin-Tempel Teks
              </button>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-accent"
              onClick={() => downloadCsvTemplate(productType)}
              title="Download format CSV resmi"
            >
              Unduh Template CSV {typeConfig.label}
            </button>
          </div>

          {/* Tab 1: File Dropzone */}
          {activeTab === "file" && (
            <div
              className={`import-dropzone ${dragOver ? "dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="dropzone-icon">📁</div>
              <div className="dropzone-text">
                <strong>Klik untuk memilih file</strong> atau seret file ke sini
              </div>
              <div className="dropzone-formats">
                Mendukung .xlsx, .xls, .csv (koma atau titik koma)
              </div>
            </div>
          )}

          {/* Tab 2: Paste Input */}
          {activeTab === "paste" && (
            <div className="import-paste-box">
              <textarea
                className="import-paste-area"
                rows={6}
                placeholder="Tempel baris dari Excel atau CSV di sini..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!pasteContent.trim() || isProcessing}
                  onClick={() => processTextData(pasteContent)}
                >
                  Proses Teks
                </button>
              </div>
            </div>
          )}

          {/* Sheet Selector if multiple sheets in Excel */}
          {sheetNames.length > 1 && (
            <div className="import-sheet-selector">
              <label htmlFor="sheetSelector">Pilih Sheet Excel:</label>
              <select
                id="sheetSelector"
                className="import-sheet-select"
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
              >
                {sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview Section */}
          {previewResult && (
            <div className="import-preview-section">
              <div className="import-preview-header">
                <div className="preview-badges">
                  <span className="badge badge-success">
                    {previewResult.added.length} Baris Valid
                  </span>
                  {previewResult.errors.length > 0 && (
                    <span className="badge badge-warning">
                      {previewResult.errors.length} Baris Dilewati
                    </span>
                  )}
                  <span className="preview-source-badge">
                    {previewResult.sourceName}
                  </span>
                </div>

                <div className="import-mode-toggle">
                  <label className="import-mode-label">
                    <input
                      type="radio"
                      name="importMode"
                      checked={!replaceAll}
                      onChange={() => setReplaceAll(false)}
                    />
                    <span>Tambah data baru (Append)</span>
                  </label>
                  <label className="import-mode-label">
                    <input
                      type="radio"
                      name="importMode"
                      checked={replaceAll}
                      onChange={() => setReplaceAll(true)}
                    />
                    <span>Gantikan semua data (Replace)</span>
                  </label>
                </div>
              </div>

              {/* Error messages if any */}
              {previewResult.errors.length > 0 && (
                <div className="import-errors-box">
                  <div className="import-errors-title">
                    Detail Baris yang Dilewati / Tidak Valid:
                  </div>
                  <ul className="import-errors-list">
                    {previewResult.errors.slice(0, 6).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {previewResult.errors.length > 6 && (
                      <li>... dan {previewResult.errors.length - 6} baris lainnya</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Data Preview Mini Table */}
              <div className="import-preview-table-wrap">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {productType === "simcard" && (
                        <>
                          <th>Penyedia</th>
                          <th>Stok</th>
                          <th>Provider</th>
                          <th>Kuota</th>
                          <th>COGS</th>
                        </>
                      )}
                      {productType === "edc_referral" && (
                        <>
                          <th>Kategori</th>
                          <th>Spec Type</th>
                          <th>Tier Qty</th>
                          <th>Harga Jual (SP)</th>
                          <th>Referral Fee %</th>
                          <th>Total Fee</th>
                        </>
                      )}
                      {productType === "router" && (
                        <>
                          <th>Nama Produk</th>
                          <th>Jenis Transaksi</th>
                          <th>COGS RTS</th>
                          <th>Margin %</th>
                          <th>Harga Jual (SP)</th>
                        </>
                      )}
                      {productType === "cloudsim" && (
                        <>
                          <th>Tipe Cloudsim</th>
                          <th>Negara</th>
                          <th>Kuota</th>
                          <th>COGS</th>
                          <th>Margin %</th>
                          <th>Harga Jual</th>
                        </>
                      )}
                      {productType === "logistik" && (
                        <>
                          <th>Rute (Origin - Dest)</th>
                          <th>Layanan / Produk</th>
                          <th>Berat</th>
                          <th>Publish Rate</th>
                          <th>Markup %</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.added.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        {productType === "simcard" && (
                          <>
                            <td>{row[0]}</td>
                            <td>{row[1]}</td>
                            <td>{row[2]}</td>
                            <td>{row[3]} GB</td>
                            <td>Rp {Number(row[4]).toLocaleString("id-ID")}</td>
                          </>
                        )}
                        {productType === "edc_referral" && (
                          <>
                            <td>{row.kategori}</td>
                            <td>{row.spec_type}</td>
                            <td>{row.tier_min_qty}–{row.tier_max_qty}</td>
                            <td>Rp {Number(row.selling_price || 0).toLocaleString("id-ID")}</td>
                            <td>{row.referral_fee_pct}%</td>
                            <td>Rp {Number(row.total_referral_fee || 0).toLocaleString("id-ID")}</td>
                          </>
                        )}
                        {productType === "router" && (
                          <>
                            <td>{row.nama_produk}</td>
                            <td>{row.jenis_transaksi}</td>
                            <td>{row.cogs_rts ? `Rp ${Number(row.cogs_rts).toLocaleString("id-ID")}` : "-"}</td>
                            <td>{row.margin_pct}%</td>
                            <td>{row.selling_price ? `Rp ${Number(row.selling_price).toLocaleString("id-ID")}` : "-"}</td>
                          </>
                        )}
                        {productType === "cloudsim" && (
                          <>
                            <td>{row.tipe_cloudsim}</td>
                            <td>{row.negara || "Domestik"}</td>
                            <td>{row.package_quota_gb} GB</td>
                            <td>{row.cogs ? `Rp ${Number(row.cogs).toLocaleString("id-ID")}` : "-"}</td>
                            <td>{row.margin_pct}%</td>
                            <td>{row.selling_price ? `Rp ${Number(row.selling_price).toLocaleString("id-ID")}` : "-"}</td>
                          </>
                        )}
                        {productType === "logistik" && (
                          <>
                            <td>{row.origin_city_code} → {row.destination_city_code}</td>
                            <td>{row.product_name || row.service_type}</td>
                            <td>{row.start_weight}–{row.end_weight} kg</td>
                            <td>{row.publish_rate ? `Rp ${Number(row.publish_rate).toLocaleString("id-ID")}` : "-"}</td>
                            <td>{row.markup_percentage}%</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewResult.added.length > 5 && (
                  <div className="import-preview-more">
                    ... dan {previewResult.added.length - 5} baris lainnya siap diimpor.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="universal-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              handleReset();
              onClose();
            }}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!previewResult || !previewResult.added.length}
            onClick={handleApplyImport}
          >
            Terapkan Import ({previewResult?.added.length || 0} baris)
          </button>
        </div>
      </div>
    </div>
  );
}
