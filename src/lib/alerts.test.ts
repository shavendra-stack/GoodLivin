import { describe, expect, it } from "vitest";
import { alertHref, canManageAlertType, isSnoozedUntilFuture, priorityRank } from "@/lib/alerts";

describe("Stage 8 alert helpers", () => {
  it("orders alert priorities by operational urgency", () => {
    expect(priorityRank("critical")).toBeGreaterThan(priorityRank("high"));
    expect(priorityRank("high")).toBeGreaterThan(priorityRank("medium"));
    expect(priorityRank("informational")).toBe(1);
  });

  it("keeps financial alert management scoped to finance or directors", () => {
    expect(canManageAlertType(["finance_team"], "purchase_order.payment_due")).toBe(true);
    expect(canManageAlertType(["inventory_manager"], "purchase_order.payment_due")).toBe(false);
    expect(canManageAlertType(["director_admin"], "purchase_order.payment_due")).toBe(true);
  });

  it("keeps retailer accounts out of operational alert management", () => {
    expect(canManageAlertType(["retailer_user"], "retailer.replenishment")).toBe(false);
    expect(canManageAlertType(["sales_manager"], "retailer.replenishment")).toBe(true);
  });

  it("routes alerts to their existing workflow pages", () => {
    expect(alertHref({ relatedTable: "purchase_orders", relatedRecordId: "po-1", batchId: null, purchaseOrderId: null, retailerId: null })).toBe("/purchase-orders/po-1");
    expect(alertHref({ relatedTable: "product_batches", relatedRecordId: "batch-1", batchId: null, purchaseOrderId: null, retailerId: null })).toBe("/batches/batch-1");
    expect(alertHref({ relatedTable: "stock_transfers", relatedRecordId: "transfer-1", batchId: null, purchaseOrderId: null, retailerId: null })).toBe("/transfers");
  });

  it("does not hide critical alerts when snoozed", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isSnoozedUntilFuture(future, "high")).toBe(true);
    expect(isSnoozedUntilFuture(future, "critical")).toBe(false);
  });
});
