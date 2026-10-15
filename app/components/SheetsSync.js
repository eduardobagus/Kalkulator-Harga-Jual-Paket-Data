"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * SheetsSync — Component for Google Sheets 2-way sync controls.
 * Includes an in-app setup form so users can configure credentials
 * directly from the browser without editing .env.local.
 */
export default function SheetsSync({
  data,
  margins,
  quantities,
  taxEnabled,
  onPull,
}) {
  const [status, setStatus] = useState("checking"); // checking | configured | not_configured | error
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // success | error | info

  // Setup form state
  const [showSetup, setShowSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formSheetId, setFormSheetId] = useState("");
  const [formSheetName, setFormSheetName] = useState("Data Produk");
  const [formJsonMode, setFormJsonMode] = useState(false); // true = paste JSON file directly
  const [formJsonText, setFormJsonText] = useState("");

  // Check Google Sheets connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/sheets?action=status");
      const result = await res.json();

      if (result.success && result.configured && result.connected) {
        setStatus("configured");
        setSheetsInfo(result);
        setShowSetup(false);
      } else if (result.configured && !result.connected) {
        setStatus("error");
        setMessage(result.error || "Gagal terhubung ke Google Sheets");
        setMessageType("error");
        setSheetsInfo(result);
      } else {
        setStatus("not_configured");
        setSheetsInfo(result);
      }
    } catch {
      setStatus("not_configured");
    }
  };

  // Save config from form
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      let email = formEmail.trim();
      let privateKey = formKey.trim();

      // If JSON mode, parse the JSON file to extract email and key
      if (formJsonMode && formJsonText.trim()) {
        try {
          const json = JSON.parse(formJsonText.trim());
          email = json.client_email || "";
          privateKey = json.private_key || "";
          if (!email || !privateKey) {
            throw new Error("JSON tidak mengandung client_email atau private_key");
          }
          // Auto-fill the fields for visibility
          setFormEmail(email);
          setFormKey(privateKey);
        } catch (parseErr) {
          setMessage(`✗ Gagal parse JSON: ${parseErr.message}`);
          setMessageType("error");
          setSaving(false);
          return;
        }
      }

      if (!email || !privateKey || !formSheetId.trim()) {
        setMessage("✗ Semua field wajib diisi");
        setMessageType("error");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            email,
            privateKey,
            spreadsheetId: formSheetId.trim(),
            sheetName: formSheetName.trim() || "Data Produk",
          },
        }),
      });

      const result = await res.json();

      if (result.success && result.connected) {
        setStatus("configured");
        setSheetsInfo(result);
        setShowSetup(false);
        setMessage("✓ Google Sheets berhasil terhubung!");
        setMessageType("success");
        // Clear sensitive form data
        setFormKey("");
        setFormJsonText("");
      } else if (result.success && !result.connected) {
        setMessage(`✗ Config tersimpan tapi koneksi gagal: ${result.error}`);
        setMessageType("error");
      } else {
        setMessage(`✗ ${result.error}`);
        setMessageType("error");
      }
    } catch (err) {
      setMessage(`✗ Error: ${err.message}`);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  // Delete config
  const handleDeleteConfig = async () => {
    if (!window.confirm("Hapus konfigurasi Google Sheets?\nSync akan berhenti sampai dikonfigurasi ulang.")) return;

    try {
      await fetch("/api/sheets", { method: "DELETE" });
      setStatus("not_configured");
      setSheetsInfo(null);
      setMessage("Konfigurasi dihapus");
      setMessageType("info");
      setShowSetup(false);
    } catch (err) {
      setMessage(`✗ Gagal hapus: ${err.message}`);
      setMessageType("error");
    }
  };

  // Push: Web → Google Sheets
  const handlePush = useCallback(async () => {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data, margins, quantities, taxEnabled }),
      });
      const result = await res.json();

      if (result.success) {
        setLastSync(new Date());
        setMessage(`✓ ${result.message}`);
        setMessageType("success");
        if (result.spreadsheetUrl) {
          setSheetsInfo((prev) => ({
            ...prev,
            spreadsheetUrl: result.spreadsheetUrl,
          }));
        }
      } else {
        setMessage(`✗ ${result.error}`);
        setMessageType("error");
      }
    } catch (err) {
      setMessage(`✗ Gagal push ke Sheets: ${err.message}`);
      setMessageType("error");
    } finally {
      setSyncing(false);
    }
  }, [data, margins, quantities, taxEnabled]);

  // Pull: Google Sheets → Web
  const handlePull = useCallback(async () => {
    if (
      !window.confirm(
        "Data di web akan ditimpa dengan data dari Google Sheets.\nLanjutkan?"
      )
    ) {
      return;
    }

    setPulling(true);
    setMessage("");
    try {
      const res = await fetch("/api/sheets?action=pull");
      const result = await res.json();

      if (
        result.success &&
        Array.isArray(result.rows) &&
        result.rows.length > 0
      ) {
        onPull({
          rows: result.rows,
          margins: result.margins,
          quantities: result.quantities,
          taxEnabled: result.taxEnabled,
        });
        setLastSync(new Date());
        setMessage(`✓ ${result.message}`);
        setMessageType("success");
      } else if (result.success && result.rows?.length === 0) {
        setMessage("Sheet kosong, tidak ada data untuk diimpor.");
        setMessageType("info");
      } else {
        setMessage(`✗ ${result.error || result.message || "Gagal pull"}`);
        setMessageType("error");
      }
    } catch (err) {
      setMessage(`✗ Gagal pull dari Sheets: ${err.message}`);
      setMessageType("error");
    } finally {
      setPulling(false);
    }
  }, [onPull]);

  const getStatusDisplay = () => {
    switch (status) {
      case "checking":
        return {
          icon: "⟳",
          label: "Mengecek koneksi...",
          cls: "sheets-status-checking",
        };
      case "configured":
        return {
          icon: "●",
          label: "Terhubung",
          cls: "sheets-status-connected",
        };
      case "error":
        return { icon: "●", label: "Error", cls: "sheets-status-error" };
      default:
        return {
          icon: "○",
          label: "Belum dikonfigurasi",
          cls: "sheets-status-off",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <section className="card card-delay-3 sheets-sync-card">
      <div className="card-header-flex">
        <h2 className="card-title">Google Sheets Sync</h2>
        <div className={`sheets-status-badge ${statusDisplay.cls}`}>
          <span className="sheets-status-dot">{statusDisplay.icon}</span>
          <span>{statusDisplay.label}</span>
        </div>
      </div>

      {/* ─── Not configured: Show setup prompt ─── */}
      {status === "not_configured" && !showSetup && (
        <div className="sheets-setup-prompt">
          <p className="sheets-setup-prompt-text">
            Hubungkan ke Google Sheets untuk mirror data otomatis.
          </p>
          <button
            className="btn btn-sheets-setup"
            onClick={() => setShowSetup(true)}
          >
            Konfigurasi Google Sheets
          </button>
        </div>
      )}

      {/* ─── Setup form (in-app, no .env editing needed) ─── */}
      {(showSetup || (status === "error" && showSetup)) && (
        <form className="sheets-setup-form" onSubmit={handleSaveConfig}>
          <div className="sheets-form-header">
            <p className="sheets-setup-title">Konfigurasi Google Sheets</p>
            <button
              type="button"
              className="sheets-form-close"
              onClick={() => setShowSetup(false)}
              title="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Guide steps */}
          <div className="sheets-setup-steps-compact">
            <div className="sheets-step">
              <span className="sheets-step-num">1</span>
              <span>
                Buat{" "}
                <a
                  href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Service Account
                </a>{" "}
                di Google Cloud, lalu enable{" "}
                <strong>Google Sheets API</strong>.
              </span>
            </div>
            <div className="sheets-step">
              <span className="sheets-step-num">2</span>
              <span>
                Download <strong>JSON key</strong> dari Service Account
                tersebut.
              </span>
            </div>
            <div className="sheets-step">
              <span className="sheets-step-num">3</span>
              <span>
                <strong>Share</strong> spreadsheet ke email Service Account
                (role: <em>Editor</em>).
              </span>
            </div>
            <div className="sheets-step">
              <span className="sheets-step-num">4</span>
              <span>
                Isi form di bawah dengan data dari JSON key &amp; link
                spreadsheet.
              </span>
            </div>
          </div>

          {/* Input mode toggle */}
          <div className="sheets-input-mode">
            <button
              type="button"
              className={`sheets-mode-btn ${!formJsonMode ? "active" : ""}`}
              onClick={() => setFormJsonMode(false)}
            >
              Isi Manual
            </button>
            <button
              type="button"
              className={`sheets-mode-btn ${formJsonMode ? "active" : ""}`}
              onClick={() => setFormJsonMode(true)}
            >
              Paste JSON Key
            </button>
          </div>

          {formJsonMode ? (
            /* JSON paste mode */
            <div className="sheets-form-group">
              <label htmlFor="sheetsJsonKey">
                Paste isi file JSON Key di sini:
              </label>
              <textarea
                id="sheetsJsonKey"
                className="sheets-input sheets-textarea"
                value={formJsonText}
                onChange={(e) => setFormJsonText(e.target.value)}
                placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...","client_email":"...@...iam.gserviceaccount.com",...}'
                rows={6}
                spellCheck={false}
              />
            </div>
          ) : (
            /* Manual mode */
            <>
              <div className="sheets-form-group">
                <label htmlFor="sheetsEmail">Service Account Email</label>
                <input
                  id="sheetsEmail"
                  type="email"
                  className="sheets-input"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="nama@project-id.iam.gserviceaccount.com"
                  autoComplete="off"
                />
              </div>

              <div className="sheets-form-group">
                <label htmlFor="sheetsKey">Private Key</label>
                <textarea
                  id="sheetsKey"
                  className="sheets-input sheets-textarea"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEv...&#10;-----END PRIVATE KEY-----"
                  rows={4}
                  spellCheck={false}
                />
              </div>
            </>
          )}

          <div className="sheets-form-group">
            <label htmlFor="sheetsSpreadsheetId">
              Spreadsheet ID{" "}
              <span className="sheets-label-hint">
                (dari URL: docs.google.com/spreadsheets/d/<strong>ID_INI</strong>/edit)
              </span>
            </label>
            <input
              id="sheetsSpreadsheetId"
              type="text"
              className="sheets-input"
              value={formSheetId}
              onChange={(e) => {
                // Auto-extract ID from full URL if pasted
                const val = e.target.value;
                const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
                setFormSheetId(match ? match[1] : val);
              }}
              placeholder="1BxiMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx atau paste link spreadsheet"
              autoComplete="off"
            />
          </div>

          <div className="sheets-form-group">
            <label htmlFor="sheetsTabName">
              Nama Tab Sheet{" "}
              <span className="sheets-label-hint">(opsional)</span>
            </label>
            <input
              id="sheetsTabName"
              type="text"
              className="sheets-input"
              value={formSheetName}
              onChange={(e) => setFormSheetName(e.target.value)}
              placeholder="Data Produk"
              autoComplete="off"
            />
          </div>

          <div className="sheets-form-actions">
            <button
              type="submit"
              className="btn btn-sheets-push"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="btn-spinner" /> Menyimpan & Mengecek...
                </>
              ) : (
                "Simpan & Hubungkan"
              )}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowSetup(false)}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* ─── Error state ─── */}
      {status === "error" && !showSetup && (
        <div className="sheets-error-box">
          <p>{message}</p>
          <div className="sheets-error-actions">
            <button className="btn btn-sm" onClick={() => setShowSetup(true)}>
              Ubah Konfigurasi
            </button>
            <button className="btn btn-sm" onClick={checkConnection}>
              Coba Lagi
            </button>
          </div>
        </div>
      )}

      {/* ─── Connected state ─── */}
      {status === "configured" && (
        <div className="sheets-controls">
          <div className="sheets-info-row">
            {sheetsInfo?.spreadsheetTitle && (
              <span className="sheets-title-tag">
                {sheetsInfo.spreadsheetTitle}
              </span>
            )}
            {sheetsInfo?.source && (
              <span className="sheets-source-tag">
                via {sheetsInfo.source === "database" ? "Web Config" : ".env"}
              </span>
            )}
            {sheetsInfo?.spreadsheetUrl && (
              <a
                href={sheetsInfo.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sheets-link"
              >
                Buka Spreadsheet
              </a>
            )}
          </div>

          <div className="sheets-btn-row">
            <button
              className="btn btn-sheets-push"
              onClick={handlePush}
              disabled={syncing || pulling}
              title="Kirim data dari web ke Google Sheets"
            >
              {syncing ? (
                <>
                  <span className="btn-spinner" /> Mengirim...
                </>
              ) : (
                <>Push ke Sheets</>
              )}
            </button>

            <button
              className="btn btn-sheets-pull"
              onClick={handlePull}
              disabled={syncing || pulling}
              title="Tarik data dari Google Sheets ke web"
            >
              {pulling ? (
                <>
                  <span className="btn-spinner" /> Mengambil...
                </>
              ) : (
                <>Pull dari Sheets</>
              )}
            </button>

            <button
              className="btn btn-sm btn-ghost"
              onClick={checkConnection}
              disabled={syncing || pulling}
              title="Refresh koneksi"
            >
              Refresh
            </button>

            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setShowSetup(true)}
              title="Ubah konfigurasi"
            >
              Ubah
            </button>

            <button
              className="btn btn-sm btn-ghost sheets-btn-danger"
              onClick={handleDeleteConfig}
              title="Hapus konfigurasi"
            >
              Hapus
            </button>
          </div>

          {lastSync && (
            <p className="sheets-last-sync">
              Terakhir sync: {lastSync.toLocaleTimeString("id-ID")}
            </p>
          )}
        </div>
      )}

      {/* ─── Feedback message ─── */}
      {message && !showSetup && status !== "error" && (
        <div className={`sheets-message sheets-message-${messageType}`}>
          {message}
        </div>
      )}
    </section>
  );
}
