"use client";

import React, { useEffect } from "react";
import { getProductTypeConfig } from "../lib/productTypes";

const fmtRupiah = (val) => {
  if (val === null || val === undefined || val === "" || isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  productType = "simcard",
}) {
  // Close on Escape, confirm on Enter
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const typeConfig = getProductTypeConfig(productType);

  // Extract display info smartly based on product type
  let productName = "Item";
  let categoryName = typeConfig.label;
  let detailRows = [];
  let dbId = null;

  if (productType === "simcard" && Array.isArray(item)) {
    productName = item[2] || "Paket Simcard";
    categoryName = item[6] || item[0] || "Simcard";
    dbId = item[5];
    detailRows = [
      { label: "Penyedia", value: item[0] || "DPT" },
      { label: "Status Stok", value: item[1] || "OPEN" },
      { label: "Kuota", value: `${item[3] ?? 0} GB` },
      { label: "COGS (Modal)", value: fmtRupiah(item[4]) },
    ];
  } else if (item && typeof item === "object") {
    dbId = item.id;
    if (productType === "router") {
      productName = item.nama_produk || "Router";
      categoryName = item.jenis_transaksi || item.kategori || "Router";
      detailRows = [
        { label: "Jenis Transaksi", value: item.jenis_transaksi || "Beli Putus" },
        { label: "Jangka Sewa", value: item.jangka_waktu_sewa ? `${item.jangka_waktu_sewa} Bulan` : "-" },
        { label: "COGS RTS", value: fmtRupiah(item.cogs_rts) },
        { label: "Harga Jual", value: fmtRupiah(item.selling_price) },
      ];
    } else if (productType === "edc_referral") {
      productName = item.kategori || "Mesin EDC";
      categoryName = item.tipe_transaksi === "MONTHLY_RENT" ? "Monthly Rent" : "One Time Charge";
      detailRows = [
        { label: "Spesifikasi", value: item.spec_type || "-" },
        { label: "Selling Price", value: fmtRupiah(item.selling_price) },
        { label: "Referral Fee (%)", value: `${item.referral_fee_pct || 0}%` },
        { label: "Fee per Unit", value: fmtRupiah(item.referral_fee_per_unit) },
      ];
    } else if (productType === "cloudsim") {
      productName = item.tipe_cloudsim || "Cloudsim";
      categoryName = item.negara ? `${item.negara} (${item.jumlah_provider || 1} Provider)` : "Cloudsim";
      detailRows = [
        { label: "Paket Kuota", value: `${item.package_quota_gb || 0} GB` },
        { label: "COGS Total", value: fmtRupiah(item.cogs) },
        { label: "Target Margin", value: `${item.margin_pct || 30}%` },
        { label: "Harga Jual", value: fmtRupiah(item.selling_price) },
      ];
    } else if (productType === "logistik") {
      const origin = item.origin_city || item.origin_city_code || "-";
      const dest = item.destination_city || item.destination_city_code || "-";
      productName = `${origin} ➔ ${dest}`;
      categoryName = item.product_name || item.service_type || "Logistik";
      detailRows = [
        { label: "Rute Pengiriman", value: productName },
        { label: "Layanan", value: item.product_name || "REGPACK" },
        { label: "Publish Rate", value: fmtRupiah(item.publish_rate) },
        { label: "Selling Rate", value: fmtRupiah(item.selling_rate) },
      ];
    }
  }

  return (
    <div
      className="universal-modal-overlay delete-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteModalTitle"
    >
      <div
        className="universal-modal-dialog delete-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning badge */}
        <div className="delete-modal-header">
          <div className="delete-icon-pulse">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
          <div>
            <h3 id="deleteModalTitle" className="delete-modal-title">
              Hapus Data {typeConfig.label}?
            </h3>
            <p className="delete-modal-sub">
              Konfirmasi penghapusan data produk dari sistem kalkulator
            </p>
          </div>
          <button
            type="button"
            className="universal-modal-close"
            onClick={onClose}
            aria-label="Tutup konfirmasi"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="delete-modal-body">
          {/* Alert Warning Box */}
          <div className="delete-alert-box">
            <div className="delete-alert-icon">⚠️</div>
            <div className="delete-alert-text">
              <strong>Peringatan:</strong> Tindakan ini akan menghapus data secara permanen dari database PostgreSQL dan menghapusnya dari seluruh perhitungan harga jual.
            </div>
          </div>

          {/* Item Details Preview Card */}
          <div className="delete-item-preview">
            <div className="delete-preview-header">
              <div className="delete-preview-name">{productName}</div>
              <div className="delete-preview-badge">{categoryName}</div>
            </div>

            <div className="delete-preview-grid">
              {detailRows.map((d, i) => (
                <div key={i} className="delete-preview-row">
                  <span className="delete-preview-label">{d.label}:</span>
                  <span className="delete-preview-val">{d.value}</span>
                </div>
              ))}
              {dbId && (
                <div className="delete-preview-row">
                  <span className="delete-preview-label">ID Database:</span>
                  <span className="delete-preview-val font-mono">#{dbId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="delete-modal-footer">
          <button
            type="button"
            className="delete-btn-cancel"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="delete-btn-confirm"
            onClick={onConfirm}
            autoFocus
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Ya, Hapus Data
          </button>
        </div>
      </div>
    </div>
  );
}
