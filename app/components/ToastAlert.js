"use client";

import React, { useEffect } from "react";

export default function ToastAlert({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isDanger = toast.type === "danger" || toast.type === "error";
  const isSuccess = toast.type === "success";

  return (
    <div className={`floating-toast-alert ${isDanger ? "toast-danger" : isSuccess ? "toast-success" : "toast-info"}`}>
      <div className="toast-icon">
        {isDanger ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      <div className="toast-content">
        <div className="toast-title">{toast.title || (isDanger ? "Data Dihapus" : "Berhasil")}</div>
        <div className="toast-message">{toast.message}</div>
      </div>

      <button type="button" className="toast-close-btn" onClick={onClose} aria-label="Tutup notifikasi">
        ✕
      </button>
    </div>
  );
}
