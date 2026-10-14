"use client";

export default function NotesSection() {
  return (
    <section className="card card-delay-3 notes-section">
      <h2 className="card-title">Cara hitung</h2>
      <p>
        <code>
          Harga jual = COGS Kena Pajak ÷ (1 − Target margin)
        </code>
        , dibulatkan ke nominal Rupiah bulat terdekat (tanpa desimal).
      </p>
      <p>
        <strong>Lima Skenario Penjualan:</strong>
        <br />
        Setiap skenario memiliki pengaturan target margin dan volume unit masing-masing. Dengan margin terpisah untuk 5 tingkat volume, harga jual otomatis berbeda menyesuaikan strategi penjualan Anda (misalnya margin lebih tinggi untuk volume kecil, margin lebih rendah untuk volume besar).
      </p>
      <p>
        <strong>Ketentuan Pajak (Tax):</strong>
        <br />
        • <strong>Penyedia RTS:</strong> PPN 11% → <code>COGS Kena Pajak = COGS × 1,11</code>
        <br />
        • <strong>Selain RTS (DPT, dll):</strong> PPN 11% + PPh 0,5% (Total 11,5%) → <code>COGS Kena Pajak = COGS × 1,115</code>
      </p>
      <p>
        Contoh perhitungan (RTS, COGS Rp 36.000):
        <br />
        COGS Kena Pajak = 36.000 × 1,11 = Rp 39.960.
        <br />
        • Skenario 1 (margin 30%): 39.960 ÷ (1 − 0,30) = 57.085,71... → <strong>Rp 57.086</strong> (margin 30,0%)
        <br />
        • Skenario 2 (margin 25%): 39.960 ÷ (1 − 0,25) = <strong>Rp 53.280</strong> (margin 25,0%)
      </p>
      <p>
        Semua nominal (pajak, modal efektif, dan harga jual) ditampilkan dalam Rupiah bulat tanpa angka desimal/koma agar mudah dan praktis untuk transaksi. Jika fitur pajak dinonaktifkan, COGS modal awal langsung digunakan sebagai dasar perhitungan.
      </p>
    </section>
  );
}
