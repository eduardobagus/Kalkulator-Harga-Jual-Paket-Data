"use client";

import { useState, useRef, useCallback } from "react";
import { parseDelimited, processImportRows } from "../lib/calculator";

export default function ImportSection({ onImport }) {
  const [isOpen, setIsOpen] = useState(true);
  const [replaceAll, setReplaceAll] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState(null); // { text, ok }
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const showMessage = (text, ok) => {
    setMessage({ text, ok });
  };

  const handleIngest = useCallback(
    (rows) => {
      const { added, errors } = processImportRows(rows);

      if (!added.length) {
        showMessage(
          "Tidak ada baris yang valid.\n" + errors.slice(0, 8).join("\n"),
          false
        );
        return;
      }

      onImport(added, replaceAll);

      let msg =
        added.length +
        " produk " +
        (replaceAll
          ? "menggantikan daftar lama."
          : "ditambahkan.");

      if (errors.length) {
        msg +=
          "\n" +
          errors.length +
          " baris dilewati:\n" +
          errors.slice(0, 8).join("\n") +
          (errors.length > 8 ? "\n..." : "");
      }

      showMessage(msg, !errors.length);
    },
    [replaceAll, onImport]
  );

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      const isText = /\.(csv|txt)$/i.test(file.name);

      reader.onerror = () => showMessage("File tidak bisa dibaca.", false);

      reader.onload = () => {
        try {
          if (isText) {
            handleIngest(parseDelimited(reader.result));
          } else {
            // Dynamic import for xlsx
            import("xlsx").then((XLSX) => {
              const wb = XLSX.read(reader.result, { type: "array" });
              const sheet = wb.Sheets[wb.SheetNames[0]];
              const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: true,
                defval: "",
              });
              handleIngest(rows);
            }).catch(() => {
              showMessage(
                "Pembaca Excel belum termuat. Simpan file sebagai CSV atau gunakan kolom tempel.",
                false
              );
            });
          }
        } catch {
          showMessage(
            "File tidak bisa diproses. Pastikan formatnya sesuai template.",
            false
          );
        }
        e.target.value = "";
      };

      if (isText) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    },
    [handleIngest]
  );

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) {
      showMessage("Tempel baris dari Excel dulu.", false);
      return;
    }
    handleIngest(parseDelimited(pasteText));
    setPasteText("");
  }, [pasteText, handleIngest]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length && fileInputRef.current) {
      fileInputRef.current.files = files;
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div className="import-section">
      <button
        type="button"
        className="import-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={`arrow ${isOpen ? "open" : ""}`}>▶</span>
        Upload massal
      </button>

      {isOpen && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <p className="import-hint">
            Kolom: Penyedia Produk, Stock Availability, Provider, Package Quota
            (GB), COGS. Pakai file template Excel, CSV, atau salin-tempel baris
            langsung dari Excel.
          </p>

          <div className="import-grid">
            <div>
              <label htmlFor="importFile">
                Upload file (.xlsx, .xls, .csv)
              </label>
              <div
                className={`dropzone ${isDragOver ? "active" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <span className="dropzone-text">
                  Tarik file ke area ini, atau pilih dari komputer
                </span>
                <input
                  id="importFile"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="importPaste">
                Atau tempel dari Excel (dengan atau tanpa baris judul)
              </label>
              <textarea
                id="importPaste"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"RTS\tOPEN\tTelkomsel Individual Sharing\t2\t36000"}
              />
              <div className="button-bar">
                <button className="btn btn-primary" onClick={handlePaste}>
                  Tambahkan hasil tempel
                </button>
              </div>
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={replaceAll}
              onChange={(e) => setReplaceAll(e.target.checked)}
            />
            Ganti semua produk yang ada (tanpa centang: ditambahkan ke daftar)
          </label>

          {message && (
            <div
              className={`import-message ${message.ok ? "success" : "error"}`}
              role="status"
            >
              {message.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
