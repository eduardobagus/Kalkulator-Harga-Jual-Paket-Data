"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DEFAULT_DATA } from "./lib/calculator";
import ThemeToggle from "./components/ThemeToggle";
import AssumptionsPanel from "./components/AssumptionsPanel";
import ProductTable from "./components/ProductTable";
import ImportSection from "./components/ImportSection";
import NotesSection from "./components/NotesSection";

const STORAGE_KEY_PRODUCTS = "kalkulator_products";
const STORAGE_KEY_ASSUMPTIONS = "kalkulator_assumptions";

export default function Home() {
  // Assumptions state (dua skenario dengan target margin dan volume masing-masing)
  const [margin1, setMargin1] = useState("30");
  const [qty1, setQty1] = useState("100");
  const [margin2, setMargin2] = useState("25");
  const [qty2, setQty2] = useState("150");
  const [taxEnabled, setTaxEnabled] = useState(true);

  // Product data
  const [data, setData] = useState(() =>
    DEFAULT_DATA.map((r) => [...r])
  );

  const [isLoaded, setIsLoaded] = useState(false);

  // Muat data dari LocalStorage saat pertama kali aplikasi dibuka
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
        }
      }

      const savedAssumptions = localStorage.getItem(STORAGE_KEY_ASSUMPTIONS);
      if (savedAssumptions) {
        const parsed = JSON.parse(savedAssumptions);
        if (parsed.margin1 !== undefined) setMargin1(String(parsed.margin1));
        if (parsed.qty1 !== undefined) setQty1(String(parsed.qty1));
        if (parsed.margin2 !== undefined) setMargin2(String(parsed.margin2));
        if (parsed.qty2 !== undefined) setQty2(String(parsed.qty2));
        if (parsed.taxEnabled !== undefined) setTaxEnabled(Boolean(parsed.taxEnabled));
      }
    } catch (err) {
      console.error("Gagal memuat data dari localStorage:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Simpan produk otomatis ke LocalStorage setiap ada perubahan
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(data));
    } catch (err) {
      console.error("Gagal menyimpan produk ke localStorage:", err);
    }
  }, [data, isLoaded]);

  // Simpan asumsi otomatis ke LocalStorage setiap ada perubahan
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY_ASSUMPTIONS,
        JSON.stringify({ margin1, qty1, margin2, qty2, taxEnabled })
      );
    } catch (err) {
      console.error("Gagal menyimpan asumsi ke localStorage:", err);
    }
  }, [margin1, qty1, margin2, qty2, taxEnabled, isLoaded]);

  // Validation
  const validationError = useMemo(() => {
    const m1 = parseFloat(margin1) / 100;
    const m2 = parseFloat(margin2) / 100;
    const q1 = parseFloat(qty1);
    const q2 = parseFloat(qty2);

    if (isNaN(m1) || m1 < 0 || m1 >= 1)
      return "Target margin skenario 1 harus antara 0% dan 99%.";
    if (isNaN(m2) || m2 < 0 || m2 >= 1)
      return "Target margin skenario 2 harus antara 0% dan 99%.";
    if (!(q1 > 0) || !(q2 > 0)) return "Jumlah unit harus lebih dari 0.";
    return null;
  }, [margin1, margin2, qty1, qty2]);

  // Handlers
  const handleUpdateRow = useCallback((index, field, value) => {
    setData((prev) => {
      const next = prev.map((r) => [...r]);
      next[index][field] = value;
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback((index) => {
    setData((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddRow = useCallback(() => {
    setData((prev) => [...prev, ["", "OPEN", "", 1, 0]]);
  }, []);

  const handleReset = useCallback(() => {
    const defaultCopy = DEFAULT_DATA.map((r) => [...r]);
    setData(defaultCopy);
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(defaultCopy));
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
          <div className="save-indicator">
            <span className="save-dot"></span> Tersimpan otomatis di browser
          </div>
        </header>

        <AssumptionsPanel
          margin1={margin1}
          setMargin1={setMargin1}
          qty1={qty1}
          setQty1={setQty1}
          margin2={margin2}
          setMargin2={setMargin2}
          qty2={qty2}
          setQty2={setQty2}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
        />

        <ProductTable
          data={data}
          onUpdate={handleUpdateRow}
          onDelete={handleDeleteRow}
          onAdd={handleAddRow}
          onReset={handleReset}
          margin1={margin1}
          margin2={margin2}
          qty1={qty1}
          qty2={qty2}
          error={validationError}
          taxEnabled={taxEnabled}
        >
          <ImportSection onImport={handleImport} />
        </ProductTable>

        <NotesSection />
      </main>
    </>
  );
}
