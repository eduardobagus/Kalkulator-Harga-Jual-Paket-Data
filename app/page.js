"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { DEFAULT_DATA } from "./lib/calculator";
import ThemeToggle from "./components/ThemeToggle";
import AssumptionsPanel from "./components/AssumptionsPanel";
import ProductTable from "./components/ProductTable";
import ImportSection from "./components/ImportSection";
import NotesSection from "./components/NotesSection";
import SheetsSync from "./components/SheetsSync";

const STORAGE_KEY_PRODUCTS = "kalkulator_products";
const STORAGE_KEY_ASSUMPTIONS = "kalkulator_assumptions";

const NUM_SCENARIOS = 5;
const DEFAULT_MARGINS = ["30", "25", "20", "15", "10"];
const DEFAULT_QUANTITIES = ["100", "150", "200", "300", "500"];

export default function Home() {
  // Assumptions state — 5 skenario (margin + volume masing-masing)
  const [margins, setMargins] = useState(DEFAULT_MARGINS);
  const [quantities, setQuantities] = useState(DEFAULT_QUANTITIES);
  const [taxEnabled, setTaxEnabled] = useState(true);

  // Product data: [penyedia, status_stok, provider, kuota_gb, cogs, id]
  const [data, setData] = useState(() => DEFAULT_DATA.map((r) => [...r]));

  const [isLoaded, setIsLoaded] = useState(false);

  // Sync / Database status: 'connecting' | 'connected' | 'saving' | 'saved' | 'error' | 'offline'
  const [dbStatus, setDbStatus] = useState("connecting");
  const [dbMessage, setDbMessage] = useState("Menghubungkan ke PostgreSQL...");

  // Ref to track whether local edits occurred after initial load
  const isInitialLoadDone = useRef(false);
  const saveTimeoutRef = useRef(null);
  const inFlightAbortRef = useRef(null);

  // 1. Load initial data from backend PostgreSQL (with fallback to localStorage)
  useEffect(() => {
    let isMounted = true;

    async function loadDataFromBackend() {
      try {
        setDbStatus("connecting");
        setDbMessage("Menghubungkan ke database...");

        // Check health and tables
        const healthRes = await fetch("/api/health");
        const healthData = await healthRes.json();

        if (!healthData.success) {
          throw new Error(healthData.error || "Gagal menghubungi database");
        }

        // Fetch products and assumptions concurrently
        const [prodRes, assumpRes] = await Promise.all([
          fetch("/api/products"),
          fetch("/api/assumptions"),
        ]);

        const prodJson = await prodRes.json();
        const assumpJson = await assumpRes.json();

        if (isMounted) {
          if (prodJson.success && Array.isArray(prodJson.rows) && prodJson.rows.length > 0) {
            setData(prodJson.rows);
            try {
              localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(prodJson.rows));
            } catch {}
          }

          if (assumpJson.success && assumpJson.assumptions) {
            const a = assumpJson.assumptions;
            if (Array.isArray(a.margins) && a.margins.length === NUM_SCENARIOS) {
              setMargins(a.margins.map(String));
            }
            if (Array.isArray(a.quantities) && a.quantities.length === NUM_SCENARIOS) {
              setQuantities(a.quantities.map(String));
            }
            if (a.taxEnabled !== undefined) {
              setTaxEnabled(Boolean(a.taxEnabled));
            }
            try {
              localStorage.setItem(STORAGE_KEY_ASSUMPTIONS, JSON.stringify(a));
            } catch {}
          }

          setDbStatus("connected");
          setDbMessage("Terhubung ke PostgreSQL (kalkulator_harga_jual)");
        }
      } catch (err) {
        console.warn("Gagal memuat dari backend PostgreSQL, menggunakan cache lokal:", err);
        if (isMounted) {
          // Fallback to localStorage
          try {
            const savedData = localStorage.getItem(STORAGE_KEY_PRODUCTS);
            if (savedData) {
              const parsed = JSON.parse(savedData);
              if (Array.isArray(parsed) && parsed.length > 0) setData(parsed);
            }
            const savedAssump = localStorage.getItem(STORAGE_KEY_ASSUMPTIONS);
            if (savedAssump) {
              const parsed = JSON.parse(savedAssump);
              if (Array.isArray(parsed.margins)) setMargins(parsed.margins.map(String));
              if (Array.isArray(parsed.quantities)) setQuantities(parsed.quantities.map(String));
              if (parsed.taxEnabled !== undefined) setTaxEnabled(Boolean(parsed.taxEnabled));
            }
          } catch {}

          setDbStatus("offline");
          setDbMessage("Mode offline (tersimpan di browser)");
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
          // Allow saves after initial load has finished
          setTimeout(() => {
            isInitialLoadDone.current = true;
          }, 400);
        }
      }
    }

    loadDataFromBackend();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Auto-save products & assumptions to PostgreSQL (debounced 600ms via unified /api/sync)
  useEffect(() => {
    if (!isLoaded || !isInitialLoadDone.current) return;

    // Save to localStorage immediately as local backup
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(data));
      localStorage.setItem(
        STORAGE_KEY_ASSUMPTIONS,
        JSON.stringify({ margins, quantities, taxEnabled })
      );
    } catch {}

    // Abort previous in-flight save request if any
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
    }

    // Debounce save to PostgreSQL
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setDbStatus("saving");
    setDbMessage("Menyimpan perubahan ke PostgreSQL...");

    saveTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      inFlightAbortRef.current = abortController;

      try {
        const syncRes = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: data, margins, quantities, taxEnabled }),
          signal: abortController.signal,
        });

        const syncResult = await syncRes.json();

        if (syncResult.success) {
          setDbStatus("saved");
          setDbMessage(`Tersimpan di database PostgreSQL (${data.length} produk)`);

          // Auto-push to Google Sheets (fire-and-forget)
          fetch("/api/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: data, margins, quantities, taxEnabled }),
          }).catch(() => {
            // Silently ignore Sheets sync errors
          });
        } else {
          console.warn("Sinkronisasi database gagal:", syncResult.error);
          setDbStatus("offline");
          setDbMessage("Tersimpan di browser (sinkronisasi DB tertunda)");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          // Request was replaced by a newer save, do nothing
          return;
        }
        console.warn("Gagal menyimpan ke PostgreSQL:", err);
        setDbStatus("offline");
        setDbMessage("Tersimpan di browser (koneksi offline)");
      }
    }, 600);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [data, margins, quantities, taxEnabled, isLoaded]);

  // Validation
  const validationError = useMemo(() => {
    for (let i = 0; i < NUM_SCENARIOS; i++) {
      const m = parseFloat(margins[i]) / 100;
      const q = parseFloat(quantities[i]);
      if (isNaN(m) || m < 0 || m >= 1)
        return `Target margin skenario ${i + 1} harus antara 0% dan 99%.`;
      if (!(q > 0))
        return `Jumlah unit skenario ${i + 1} harus lebih dari 0.`;
    }
    return null;
  }, [margins, quantities]);

  // Handlers
  const handleUpdateRow = useCallback((index, field, value) => {
    setData((prev) => {
      const next = prev.map((r) => [...r]);
      next[index][field] = value;
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback(async (index) => {
    setData((prev) => {
      const target = prev[index];
      // If product has an ID in PostgreSQL, trigger delete
      if (target && target[5]) {
        fetch(`/api/products?id=${target[5]}`, { method: "DELETE" }).catch(() => {});
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setData((prev) => [...prev, ["DPT", "OPEN", "", 1, 0]]);
  }, []);

  const handleReset = useCallback(async () => {
    const defaultCopy = DEFAULT_DATA.map((r) => [...r]);
    setData(defaultCopy);
    setMargins(DEFAULT_MARGINS);
    setQuantities(DEFAULT_QUANTITIES);
    setTaxEnabled(true);
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(defaultCopy));
      localStorage.setItem(
        STORAGE_KEY_ASSUMPTIONS,
        JSON.stringify({
          margins: DEFAULT_MARGINS,
          quantities: DEFAULT_QUANTITIES,
          taxEnabled: true,
        })
      );
    } catch (err) {
      console.error("Gagal mereset localStorage:", err);
    }
  }, []);

  const handleImport = useCallback((added, replaceAll) => {
    if (replaceAll) {
      setData(added);
    } else {
      setData((prev) => [...prev, ...added]);
    }
  }, []);

  // Handle pull from Google Sheets (2-way sync)
  const handleSheetsPull = useCallback(({ rows, margins: m, quantities: q, taxEnabled: t }) => {
    if (Array.isArray(rows) && rows.length > 0) {
      setData(rows);
    }
    if (Array.isArray(m) && m.length === NUM_SCENARIOS) {
      setMargins(m.map(String));
    }
    if (Array.isArray(q) && q.length === NUM_SCENARIOS) {
      setQuantities(q.map(String));
    }
    if (t !== null && t !== undefined) {
      setTaxEnabled(Boolean(t));
    }
  }, []);

  return (
    <>
      <ThemeToggle />

      <main className="app-container">
        <header className="app-header">
          <h1>Kalkulator Harga Jual Paket Data</h1>
          <p className="subtitle">
            Masukkan target margin untuk tiap skenario volume penjualan dan COGS produk.
            Harga jual dihitung otomatis dalam nominal Rupiah bulat tanpa desimal.
          </p>

          <div
            className={`save-indicator ${
              dbStatus === "saving"
                ? "saving"
                : dbStatus === "offline" || dbStatus === "error"
                ? "error"
                : "connected"
            }`}
          >
            <span className="save-dot"></span>
            <span>{dbMessage}</span>
            <span className="save-db-badge">PostgreSQL</span>
          </div>
        </header>

        <AssumptionsPanel
          margins={margins}
          setMargins={setMargins}
          quantities={quantities}
          setQuantities={setQuantities}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
        />

        <ProductTable
          data={data}
          onUpdate={handleUpdateRow}
          onDelete={handleDeleteRow}
          onAdd={handleAddRow}
          onReset={handleReset}
          margins={margins}
          quantities={quantities}
          error={validationError}
          taxEnabled={taxEnabled}
        >
          <ImportSection onImport={handleImport} />
        </ProductTable>

        <SheetsSync
          data={data}
          margins={margins}
          quantities={quantities}
          taxEnabled={taxEnabled}
          onPull={handleSheetsPull}
        />

        <NotesSection />
      </main>
    </>
  );
}
