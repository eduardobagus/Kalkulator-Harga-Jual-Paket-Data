"use client";

const DEFAULT_MARGINS = ["30", "25", "20", "15", "10"];
const DEFAULT_QUANTITIES = ["100", "150", "200", "300", "500"];

export default function AssumptionsPanel({
  margins = DEFAULT_MARGINS,
  setMargins,
  quantities = DEFAULT_QUANTITIES,
  setQuantities,
  taxEnabled,
  setTaxEnabled,
}) {
  const safeMargins = Array.isArray(margins) ? margins : DEFAULT_MARGINS;
  const safeQuantities = Array.isArray(quantities) ? quantities : DEFAULT_QUANTITIES;

  const handleMarginChange = (index, value) => {
    const next = [...safeMargins];
    next[index] = value;
    setMargins(next);
  };

  const handleQtyChange = (index, value) => {
    const next = [...safeQuantities];
    next[index] = value;
    setQuantities(next);
  };

  return (
    <section className="card card-delay-1">
      <div className="card-header-flex">
        <h2 className="card-title">Margin</h2>
        <span className="assumptions-hint-badge">5 Tingkat Margin & Volume</span>
      </div>

      <div className="assumptions-table-wrapper">
        <table className="assumptions-compact-table">
          <thead>
            <tr>
              <th className="th-scenario">Skenario</th>
              <th className="th-margin">Target Margin</th>
              <th className="th-qty">Volume Penjualan</th>
            </tr>
          </thead>
          <tbody>
            {safeMargins.map((margin, i) => {
              const scenarioColors = [
                { color: "var(--accent-light)", dot: "var(--accent)" },
                { color: "#38bdf8", dot: "#38bdf8" },
                { color: "#a78bfa", dot: "#a78bfa" },
                { color: "#fb923c", dot: "#fb923c" },
                { color: "#f472b6", dot: "#f472b6" },
              ];
              const sc = scenarioColors[i] || scenarioColors[0];
              return (
                <tr key={i} className={`assumption-row assumption-row-s${i + 1}`}>
                  <td className="td-scenario">
                    <div className="scenario-tag">
                      <span
                        className="scenario-bullet"
                        style={{ backgroundColor: sc.dot, boxShadow: `0 0 8px ${sc.dot}88` }}
                      />
                      <span className="scenario-name" style={{ color: sc.color }}>
                        Skenario {i + 1}
                      </span>
                    </div>
                  </td>
                  <td className="td-margin">
                    <div className="input-wrapper compact-wrapper">
                      <input
                        id={`margin${i + 1}`}
                        type="number"
                        value={margin}
                        onChange={(e) => handleMarginChange(i, e.target.value)}
                        min="0"
                        max="99"
                        step="0.5"
                        placeholder="0"
                        aria-label={`Target margin skenario ${i + 1}`}
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </td>
                  <td className="td-qty">
                    <div className="input-wrapper compact-wrapper">
                      <input
                        id={`qty${i + 1}`}
                        type="number"
                        value={safeQuantities[i] ?? ""}
                        onChange={(e) => handleQtyChange(i, e.target.value)}
                        min="1"
                        step="1"
                        placeholder="0"
                        aria-label={`Volume penjualan skenario ${i + 1}`}
                      />
                      <span className="input-suffix">unit</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                className={`badge ${taxEnabled ? "badge-success" : "badge-tax-off"
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
