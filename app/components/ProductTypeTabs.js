"use client";

import React from "react";
import { PRODUCT_TYPES, getProductTypeConfig } from "../lib/productTypes";

export default function ProductTypeTabs({
  activeType,
  onChangeType,
  typeCounts = {},
}) {
  const currentConfig = getProductTypeConfig(activeType);

  return (
    <div className="product-type-dropdown-bar">
      <div className="product-type-dropdown-left">
        <label htmlFor="productTypeSelect" className="product-type-dropdown-label">
          Jenis Produk:
        </label>
        <div className="product-type-dropdown-control">
          <select
            id="productTypeSelect"
            className="product-type-dropdown-select"
            value={activeType}
            onChange={(e) => onChangeType(e.target.value)}
            aria-label="Pilih Jenis Produk"
          >
            {PRODUCT_TYPES.map((type) => {
              const count = typeCounts[type.id] ?? 0;
              return (
                <option key={type.id} value={type.id}>
                  {type.label} ({count} produk)
                </option>
              );
            })}
          </select>
        </div>
      </div>
      {currentConfig?.description && (
        <span className="product-type-dropdown-hint">
          {currentConfig.description}
        </span>
      )}
    </div>
  );
}
