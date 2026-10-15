"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { DEFAULT_DATA } from "./lib/calculator";
import { getProductTypeConfig } from "./lib/productTypes";
import ThemeToggle from "./components/ThemeToggle";
import AssumptionsPanel from "./components/AssumptionsPanel";
import ProductTable from "./components/ProductTable";
import ImportSection from "./components/ImportSection";
import NotesSection from "./components/NotesSection";
import SheetsSync from "./components/SheetsSync";
import EdcTable from "./components/EdcTable";
import RouterTable from "./components/RouterTable";
import CloudsimTable from "./components/CloudsimTable";
import LogistikTable from "./components/LogistikTable";

const STORAGE_KEY_PRODUCTS = "kalkulator_products";
const STORAGE_KEY_ASSUMPTIONS = "kalkulator_assumptions";

const NUM_SCENARIOS = 5;
const DEFAULT_MARGINS = ["30", "25", "20", "15", "10"];
const DEFAULT_QUANTITIES = ["100", "150", "200", "300", "500"];

export default function Home() {
  // Master Product Type: 'simcard' | 'edc_referral' | 'router' | 'cloudsim' | 'logistik'
  const [activeProductType, setActiveProductType] = useState("simcard");
  const [typeCounts, setTypeCounts] = useState({
    simcard: 0,
    edc_referral: 0,
    router: 0,
    cloudsim: 0,
    logistik: 0,
  });

  // Assumptions state (Simcard S1-S5)
  const [margins, setMargins] = useState(DEFAULT_MARGINS);
  const [quantities, setQuantities] = useState(DEFAULT_QUANTITIES);
  const [taxEnabled, setTaxEnabled] = useState(true);

  // Simcard data: [penyedia, status_stok, provider, kuota_gb, cogs, id, kategori]
  const [data, setData] = useState(() => DEFAULT_DATA.map((r) => [...r]));

  // Dedicated module items for EDC, Router, Cloudsim, Logistik
  const [moduleItems, setModuleItems] = useState([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Sync / Database status: 'connecting' | 'connected' | 'saving' | 'saved' | 'error' | 'offline'
  const [dbStatus, setDbStatus] = useState("connecting");
  const [dbMessage, setDbMessage] = useState("Menghubungkan ke PostgreSQL...");

  // Ref to track whether initial load finished
  const isInitialLoadDone = useRef(false);
  const saveTimeoutRef = useRef(null);
  const inFlightAbortRef = useRef(null);

  // 1. Load initial data from backend PostgreSQL for active product type
  useEffect(() => {
    let isMounted = true;

    async function loadDataFromBackend() {
      try {
        setDbStatus("connecting");
        setDbMessage("Menghubungkan ke database...");

        // Check health and get counts for all 5 product types
        const healthRes = await fetch("/api/health");
        const healthData = await healthRes.json();

        if (!healthData.success) {
          throw new Error(healthData.error || "Gagal menghubungi database");
        }

        if (healthData.counts) {
          setTypeCounts(healthData.counts);
        }

        // Fetch products for active type and assumptions concurrently
        const [prodRes, assumpRes] = await Promise.all([
          fetch(`/api/products?type=${activeProductType}`),
          fetch("/api/assumptions"),
        ]);

        const prodJson = await prodRes.json();
        const assumpJson = await assumpRes.json();

        if (isMounted) {
          if (prodJson.success) {
            if (activeProductType === "simcard") {
              if (Array.isArray(prodJson.rows)) {
                setData(prodJson.rows);
                try {
                  localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${activeProductType}`, JSON.stringify(prodJson.rows));
                } catch {}
              }
            } else {
              if (Array.isArray(prodJson.items)) {
                setModuleItems(prodJson.items);
                try {
                  localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${activeProductType}`, JSON.stringify(prodJson.items));
                } catch {}
              }
            }
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
          const dbLabel = healthData.database
            ? `${healthData.host ? `${healthData.host} / ` : ""}${healthData.database}`
            : "PostgreSQL";
          setDbMessage(`Terhubung ke ${dbLabel}`);
        }
      } catch (err) {
        console.warn("Gagal memuat dari backend PostgreSQL, menggunakan cache lokal:", err);
        if (isMounted) {
          try {
            const savedData = localStorage.getItem(`${STORAGE_KEY_PRODUCTS}_${activeProductType}`);
            if (savedData) {
              const parsed = JSON.parse(savedData);
              if (activeProductType === "simcard" && Array.isArray(parsed)) setData(parsed);
              else if (activeProductType !== "simcard" && Array.isArray(parsed)) setModuleItems(parsed);
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

  // Handler to switch product type (Excel sheet)
  const handleChangeProductType = useCallback(
    async (newType) => {
      if (newType === activeProductType) return;
      setActiveProductType(newType);
      setIsLoaded(false);
      isInitialLoadDone.current = false;

      const typeConfig = getProductTypeConfig(newType);

      try {
        setDbStatus("connecting");
        setDbMessage(`Memuat data ${typeConfig.label}...`);

        const prodRes = await fetch(`/api/products?type=${newType}`);
        const prodJson = await prodRes.json();

        if (prodJson.success) {
          if (newType === "simcard") {
            if (Array.isArray(prodJson.rows)) {
              setData(prodJson.rows);
              try {
                localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${newType}`, JSON.stringify(prodJson.rows));
              } catch {}
            }
          } else {
            if (Array.isArray(prodJson.items)) {
              setModuleItems(prodJson.items);
              try {
                localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${newType}`, JSON.stringify(prodJson.items));
              } catch {}
            }
          }
        } else {
          if (newType === "simcard") setData([]);
          else setModuleItems([]);
        }

        setDbStatus("connected");
        setDbMessage(`Aktif: ${typeConfig.label}`);
      } catch (err) {
        console.warn(`Gagal memuat produk ${newType}:`, err);
        try {
          const cached = localStorage.getItem(`${STORAGE_KEY_PRODUCTS}_${newType}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (newType === "simcard") setData(parsed);
            else setModuleItems(parsed);
          }
        } catch {}
        setDbStatus("offline");
        setDbMessage(`Mode offline: ${typeConfig.label}`);
      } finally {
        setIsLoaded(true);
        setTimeout(() => {
          isInitialLoadDone.current = true;
        }, 400);
      }
    },
    [activeProductType]
  );

  // 2. Auto-save products & assumptions to PostgreSQL (debounced 600ms via unified /api/sync)
  useEffect(() => {
    if (!isLoaded || !isInitialLoadDone.current) return;

    // Save to localStorage immediately as local backup
    try {
      if (activeProductType === "simcard") {
        localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${activeProductType}`, JSON.stringify(data));
        localStorage.setItem(
          STORAGE_KEY_ASSUMPTIONS,
          JSON.stringify({ margins, quantities, taxEnabled })
        );
      } else {
        localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_${activeProductType}`, JSON.stringify(moduleItems));
      }
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
    setDbMessage(`Menyimpan perubahan ${getProductTypeConfig(activeProductType).label} ke PostgreSQL...`);

    saveTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      inFlightAbortRef.current = abortController;

      try {
        const payload = {
          type: activeProductType,
        };

        if (activeProductType === "simcard") {
          payload.rows = data;
          payload.margins = margins;
          payload.quantities = quantities;
          payload.taxEnabled = taxEnabled;
        } else {
          payload.items = moduleItems;
        }

        const syncRes = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        const syncResult = await syncRes.json();

        if (syncResult.success) {
          const currentCount = activeProductType === "simcard" ? data.length : moduleItems.length;
          setDbStatus("saved");
          setDbMessage(
            `Tersimpan di database (${getProductTypeConfig(activeProductType).label}: ${currentCount} item)`
          );

          // Update type counts in state
          setTypeCounts((prev) => ({
            ...prev,
            [activeProductType]: currentCount,
          }));

          // Auto-push to Google Sheets if simcard
          if (activeProductType === "simcard") {
            fetch("/api/sheets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: activeProductType,
                rows: data,
                margins,
                quantities,
                taxEnabled,
              }),
            }).catch(() => {});
          }
        } else {
          console.warn("Sinkronisasi database gagal:", syncResult.error);
          setDbStatus("offline");
          setDbMessage("Tersimpan di browser (sinkronisasi DB tertunda)");
        }
      } catch (err) {
        if (err.name === "AbortError") {
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
  }, [data, moduleItems, margins, quantities, taxEnabled, isLoaded, activeProductType]);

  // Validation for Simcard
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

  // Simcard Handlers
  const handleUpdateRow = useCallback((index, field, value) => {
    setData((prev) => {
      const next = prev.map((r) => [...r]);
      next[index][field] = value;
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback(
    async (index) => {
      setData((prev) => {
        const target = prev[index];
        if (target && target[5]) {
          fetch(`/api/products?id=${target[5]}&type=simcard`, {
            method: "DELETE",
          }).catch(() => {});
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    []
  );

  const handleAddRow = useCallback((category) => {
    const cat = category !== undefined && category !== null ? category : "";
    setData((prev) => [...prev, ["DPT", "OPEN", "", 1, 0, null, cat]]);
  }, []);

  const handleReset = useCallback(async () => {
    const defaultCopy = DEFAULT_DATA.map((r) => [...r]);
    setData(defaultCopy);
    setMargins(DEFAULT_MARGINS);
    setQuantities(DEFAULT_QUANTITIES);
    setTaxEnabled(true);
    try {
      localStorage.setItem(`${STORAGE_KEY_PRODUCTS}_simcard`, JSON.stringify(defaultCopy));
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

  // Module items handlers (EDC, Router, Cloudsim, Logistik)
  const handleUpdateModuleItem = useCallback((index, updatedItem) => {
    setModuleItems((prev) => {
      const next = [...prev];
      next[index] = updatedItem;
      return next;
    });
  }, []);

  const handleDeleteModuleItem = useCallback(
    async (index) => {
      setModuleItems((prev) => {
        const target = prev[index];
        if (target && target.id) {
          fetch(`/api/products?id=${target.id}&type=${activeProductType}`, {
            method: "DELETE",
          }).catch(() => {});
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [activeProductType]
  );

  const handleAddModuleItem = useCallback((newItem) => {
    setModuleItems((prev) => [...prev, newItem]);
  }, []);

  const handleBatchUpdateModuleItems = useCallback((importedItems, replaceAll) => {
    if (replaceAll) {
      setModuleItems(importedItems);
    } else {
      setModuleItems((prev) => [...prev, ...importedItems]);
    }
  }, []);

  // Handle pull from Google Sheets (2-way sync for Simcard)
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
          <h1>Kalkulator Harga Jual Paket Data & Produk</h1>
          <p className="subtitle">
            Kalkulator multi-produk terintegrasi: Simcard, Referral Fee EDC, Router, Cloudsim, dan Logistik.
            Harga jual dihitung otomatis dengan margin dinamis dan nominal Rupiah bulat tanpa desimal.
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

        {/* 1. SIMCARD MENU */}
        {activeProductType === "simcard" && (
          <>
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
              productType={activeProductType}
              onChangeProductType={handleChangeProductType}
              typeCounts={{
                ...typeCounts,
                simcard: data.length,
              }}
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
          </>
        )}

        {/* 2. REFERRAL FEE EDC MENU */}
        {activeProductType === "edc_referral" && (
          <EdcTable
            items={moduleItems}
            onUpdate={handleUpdateModuleItem}
            onDelete={handleDeleteModuleItem}
            onAdd={handleAddModuleItem}
            onBatchUpdate={handleBatchUpdateModuleItems}
            productType={activeProductType}
            onChangeProductType={handleChangeProductType}
            typeCounts={{
              ...typeCounts,
              edc_referral: moduleItems.length,
            }}
          />
        )}

        {/* 3. ROUTER MENU */}
        {activeProductType === "router" && (
          <RouterTable
            items={moduleItems}
            onUpdate={handleUpdateModuleItem}
            onDelete={handleDeleteModuleItem}
            onAdd={handleAddModuleItem}
            onBatchUpdate={handleBatchUpdateModuleItems}
            productType={activeProductType}
            onChangeProductType={handleChangeProductType}
            typeCounts={{
              ...typeCounts,
              router: moduleItems.length,
            }}
          />
        )}

        {/* 4. CLOUDSIM MENU */}
        {activeProductType === "cloudsim" && (
          <CloudsimTable
            items={moduleItems}
            onUpdate={handleUpdateModuleItem}
            onDelete={handleDeleteModuleItem}
            onAdd={handleAddModuleItem}
            onBatchUpdate={handleBatchUpdateModuleItems}
            productType={activeProductType}
            onChangeProductType={handleChangeProductType}
            typeCounts={{
              ...typeCounts,
              cloudsim: moduleItems.length,
            }}
          />
        )}

        {/* 5. LOGISTIK MENU */}
        {activeProductType === "logistik" && (
          <LogistikTable
            items={moduleItems}
            onUpdate={handleUpdateModuleItem}
            onDelete={handleDeleteModuleItem}
            onAdd={handleAddModuleItem}
            onBatchUpdate={handleBatchUpdateModuleItems}
            productType={activeProductType}
            onChangeProductType={handleChangeProductType}
            typeCounts={{
              ...typeCounts,
              logistik: moduleItems.length,
            }}
          />
        )}
      </main>
    </>
  );
}
