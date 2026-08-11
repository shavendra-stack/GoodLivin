"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FormField } from "@/components/master-data-ui";
import { Select } from "@/components/ui/select";

type ProductOption = { id: string; productCode: string; name: string; status: string };
type SkuOption = { id: string; productId: string; skuCode: string; sellableName: string; status: string };

export function BatchProductSkuFields({
  products,
  skus,
  initialProductId,
  initialSkuId,
}: {
  products: ProductOption[];
  skus: SkuOption[];
  initialProductId?: string | null;
  initialSkuId?: string | null;
}) {
  const firstProductId = initialProductId || products[0]?.id || "";
  const [productId, setProductId] = useState(firstProductId);
  const filteredSkus = useMemo(() => skus.filter((sku) => sku.productId === productId), [productId, skus]);
  const initialSkuBelongsToProduct = Boolean(initialSkuId && filteredSkus.some((sku) => sku.id === initialSkuId));
  const [skuId, setSkuId] = useState(initialSkuBelongsToProduct ? initialSkuId ?? "" : filteredSkus[0]?.id ?? "");
  const selectedSkuStillValid = filteredSkus.some((sku) => sku.id === skuId);
  const effectiveSkuId = selectedSkuStillValid ? skuId : filteredSkus[0]?.id ?? "";

  function handleProductChange(nextProductId: string) {
    setProductId(nextProductId);
    const nextSku = skus.find((sku) => sku.productId === nextProductId);
    setSkuId(nextSku?.id ?? "");
  }

  return (
    <>
      <FormField label="Product" required>
        <Select name="productId" required value={productId} onChange={(event) => handleProductChange(event.target.value)}>
          {products.length === 0 ? <option value="">No active products available</option> : null}
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · {product.productCode}
            </option>
          ))}
        </Select>
      </FormField>
      <label className="block space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Sellable SKU<span className="text-red-600"> *</span>
        </span>
        <Select name="skuId" required value={effectiveSkuId} onChange={(event) => setSkuId(event.target.value)} disabled={filteredSkus.length === 0}>
          {filteredSkus.length === 0 ? <option value="">No SKUs for selected product</option> : null}
          {filteredSkus.map((sku) => (
            <option key={sku.id} value={sku.id}>
              {sku.sellableName} · {sku.skuCode}
            </option>
          ))}
        </Select>
        <span className="block text-xs leading-5 text-slate-400">
          {filteredSkus.length > 0 ? "Only SKUs belonging to the selected product are shown." : "Create a sellable SKU for this product before saving a batch."}
        </span>
        {productId ? (
          <Link href={`/products?skuProduct=${productId}&skuEdit=new#sku-form`} className="mt-2 inline-flex text-xs font-semibold text-forest-700 hover:text-forest-900">
            Add SKU for this product
          </Link>
        ) : null}
      </label>
    </>
  );
}
