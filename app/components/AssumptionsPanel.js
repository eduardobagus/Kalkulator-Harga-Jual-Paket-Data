"use client";

export default function AssumptionsPanel({
  margin1,
  setMargin1,
  qty1,
  setQty1,
  margin2,
  setMargin2,
  qty2,
  setQty2,
  taxEnabled,
  setTaxEnabled,
}) {
  return (
    <section className="card card-delay-1">
      <h2 className="card-title">Asumsi</h2>
      <div className="input-grid">
        <div className="input-group">
          <label htmlFor="margin1">Target margin skenario 1</label>
          <div className="input-wrapper">
            <input
              id="margin1"
              type="number"
              value={margin1}
              onChange={(e) => setMargin1(e.target.value)}
              min="0"
              max="99"
              step="0.5"
            />
            <span className="input-suffix">%</span>
          </div>
          <div className="input-hint">Target margin untuk skenario 1</div>
        </div>

        <div className="input-group">
          <label htmlFor="qty1">Skenario penjualan 1</label>
          <div className="input-wrapper">
            <input
              id="qty1"
              type="number"
              value={qty1}
              onChange={(e) => setQty1(e.target.value)}
              min="1"
              step="1"
            />
            <span className="input-suffix">unit</span>
          </div>
          <div className="input-hint">Volume penjualan skenario 1</div>
        </div>

        <div className="input-group">
          <label htmlFor="margin2">Target margin skenario 2</label>
          <div className="input-wrapper">
            <input
              id="margin2"
              type="number"
              value={margin2}
              onChange={(e) => setMargin2(e.target.value)}
              min="0"
              max="99"
              step="0.5"
            />
            <span className="input-suffix">%</span>
          </div>
          <div className="input-hint">Target margin untuk skenario 2</div>
        </div>

        <div className="input-group">
          <label htmlFor="qty2">Skenario penjualan 2</label>
          <div className="input-wrapper">
            <input
              id="qty2"
              type="number"
              value={qty2}
              onChange={(e) => setQty2(e.target.value)}
              min="1"
              step="1"
            />
            <span className="input-suffix">unit</span>
          </div>
          <div className="input-hint">Volume penjualan skenario 2</div>
        </div>
      </div>

      <div className="tax-section">
        <div className="tax-info-left">
          <label className="switch" htmlFor="taxToggle">
            <input
              id="taxToggle"
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
            />
            <span className="switch-slider" />
          </label>
          <div className="tax-toggle-label">
            <span className="tax-toggle-title">
              Hitung Pajak (Tax)
              <span
                className={`badge ${
                  taxEnabled ? "badge-success" : "badge-tax-off"
                }`}
              >
                {taxEnabled ? "Aktif" : "Nonaktif"}
              </span>
            </span>
            <span className="tax-toggle-desc">
              Pajak ditambahkan langsung ke COGS/HPP modal produk sebelum perhitungan harga jual.
            </span>
          </div>
        </div>

        <div className="tax-rules-pills">
          <span className={`tax-rule-pill ${taxEnabled ? "active-rts" : ""}`}>
            <strong>RTS:</strong> PPN 11%
          </span>
          <span
            className={`tax-rule-pill ${taxEnabled ? "active-non-rts" : ""}`}
          >
            <strong>Selain RTS:</strong> PPN 11% + PPh 0,5% (Total 11,5%)
          </span>
        </div>
      </div>
    </section>
  );
}
