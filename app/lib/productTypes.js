/**
 * Master Product Types Definition.
 * Maps Excel tabs to PostgreSQL tables and metadata.
 */
export const PRODUCT_TYPES = [
  {
    id: "simcard",
    label: "Simcard",
    shortLabel: "Simcard",
    table: "simcard_produk",
    tierTable: "simcard_tier_harga",
    defaultKategori: "IOT_M2M",
    description: "Paket Data Simcard (IoT/M2M, Postpaid, Prepaid, SPI, PAYU)",
    categories: [
      {
        key: "IOT_M2M",
        label: "Monthly Charge - IoT/M2M",
        shortLabel: "IoT / M2M",
        badgeClass: "badge-cat-iot",
        color: "#0284c7",
        keywords: ["monthly charge - iot/m2m", "iot/m2m", "iot", "m2m"],
      },
      {
        key: "POSTPAID",
        label: "Monthly Charge - Postpaid",
        shortLabel: "Postpaid",
        badgeClass: "badge-cat-postpaid",
        color: "#8b5cf6",
        keywords: ["monthly charge - postpaid", "postpaid", "pascabayar"],
      },
      {
        key: "PREPAID",
        label: "Monthly Charge - Prepaid",
        shortLabel: "Prepaid",
        badgeClass: "badge-cat-prepaid",
        color: "#10b981",
        keywords: ["monthly charge - prepaid", "prepaid", "prabayar"],
      },
      {
        key: "SPI",
        label: "Simcard non Human - SPI",
        shortLabel: "SPI",
        badgeClass: "badge-cat-spi",
        color: "#f59e0b",
        keywords: ["simcard non human - spi", "non human", "spi"],
      },
      {
        key: "PAYU",
        label: "PAYU TSEL",
        shortLabel: "PAYU",
        badgeClass: "badge-cat-payu",
        color: "#ec4899",
        keywords: ["payu tsel", "payu", "tambah stock avail"],
      },
    ],
  },
  {
    id: "edc_referral",
    label: "Referral Fee EDC",
    shortLabel: "EDC Referral",
    table: "edc_referral_produk",
    tierTable: "edc_referral_tier_harga",
    defaultKategori: "EDC — One Time Charge",
    description: "Perhitungan Margin & Referral Fee Mesin EDC (One Time Charge & Monthly Rent)",
    categories: [
      {
        key: "EDC — One Time Charge",
        label: "EDC — One Time Charge",
        shortLabel: "One Time Charge",
        badgeClass: "badge-cat-iot",
        color: "#0284c7",
        keywords: ["one time charge", "one time", "beli putus", "otc"],
      },
      {
        key: "EDC — Rent (Monthly Charge)",
        label: "EDC — Rent (Monthly Charge)",
        shortLabel: "Monthly Rent",
        badgeClass: "badge-cat-postpaid",
        color: "#8b5cf6",
        keywords: ["rent", "monthly charge", "monthly rent", "sewa"],
      },
    ],
  },
  {
    id: "router",
    label: "Router",
    shortLabel: "Router",
    table: "router_produk",
    tierTable: "router_tier_harga",
    defaultKategori: "Beli Putus",
    description: "Perangkat, Sewa & Aksesoris Router (Router C9, Dongle D200, Antena & Adaptor)",
    categories: [
      {
        key: "Beli Putus",
        label: "Beli Putus",
        shortLabel: "Beli Putus",
        badgeClass: "badge-cat-postpaid",
        color: "#8b5cf6",
        keywords: ["beli putus", "hardware", "device", "perangkat"],
      },
      {
        key: "Sewa",
        label: "Sewa (Rental)",
        shortLabel: "Sewa",
        badgeClass: "badge-cat-iot",
        color: "#0284c7",
        keywords: ["sewa", "rental", "12 bulan"],
      },
      {
        key: "Aksesoris",
        label: "Aksesoris",
        shortLabel: "Aksesoris",
        badgeClass: "badge-cat-spi",
        color: "#f59e0b",
        keywords: ["aksesoris", "antena", "adaptor"],
      },
    ],
  },
  {
    id: "cloudsim",
    label: "Cloudsim",
    shortLabel: "Cloudsim",
    table: "cloudsim_produk",
    tierTable: "cloudsim_tier_harga",
    defaultKategori: "Monthly Charge — 3 Provider",
    description: "Layanan Kuota & Manajemen Cloudsim (Multi-Operator Domestik & Roaming)",
    categories: [
      {
        key: "Monthly Charge — 3 Provider",
        label: "Monthly Charge — 3 Provider",
        shortLabel: "3 Provider",
        badgeClass: "badge-cat-iot",
        color: "#0284c7",
        keywords: ["3 provider", "three provider"],
      },
      {
        key: "Monthly Charge — 2 Provider",
        label: "Monthly Charge — 2 Provider",
        shortLabel: "2 Provider",
        badgeClass: "badge-cat-prepaid",
        color: "#10b981",
        keywords: ["2 provider", "two provider"],
      },
      {
        key: "Monthly Charge — 1 Provider",
        label: "Monthly Charge — 1 Provider",
        shortLabel: "1 Provider",
        badgeClass: "badge-cat-postpaid",
        color: "#8b5cf6",
        keywords: ["1 provider", "one provider"],
      },
      {
        key: "Monthly Charge — 1 Provider Roaming",
        label: "Monthly Charge — 1 Provider Roaming",
        shortLabel: "Roaming (Intl)",
        badgeClass: "badge-cat-payu",
        color: "#ec4899",
        keywords: ["roaming", "malaysia", "international"],
      },
    ],
  },
  {
    id: "logistik",
    label: "Logistik",
    shortLabel: "Logistik",
    table: "logistik_produk",
    tierTable: "logistik_tier_harga",
    defaultKategori: "REGPACK",
    description: "Kalkulator Pengiriman, Rute & Simulasi Cek Ongkir",
    categories: [
      {
        key: "REGPACK",
        label: "REGPACK (Reguler)",
        shortLabel: "REGPACK",
        badgeClass: "badge-cat-spi",
        color: "#f59e0b",
        keywords: ["regpack", "reguler", "standard"],
      },
      {
        key: "ONEPACK",
        label: "ONEPACK (Express)",
        shortLabel: "ONEPACK",
        badgeClass: "badge-cat-payu",
        color: "#ec4899",
        keywords: ["onepack", "express", "sameday", "overnight"],
      },
      {
        key: "CARGO",
        label: "CARGO (Kargo Berat)",
        shortLabel: "CARGO",
        badgeClass: "badge-cat-default",
        color: "#64748b",
        keywords: ["cargo", "kargo", "heavy"],
      },
    ],
  },
];

export function getProductTypeConfig(typeId) {
  const normalized = String(typeId || "").toLowerCase().trim();
  const found = PRODUCT_TYPES.find(
    (p) =>
      p.id === normalized ||
      p.label.toLowerCase() === normalized ||
      p.table === normalized
  );
  return found || PRODUCT_TYPES[0]; // fallback to simcard
}
