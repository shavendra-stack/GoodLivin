import { describe, expect, it } from "vitest";
import { getExpiryBucket, hasSufficientShelfLife, isFefoEligible, rankFefo } from "@/lib/batches";

const today = "2026-08-02";

describe("batch expiry and FEFO logic", () => {
  it("categorizes expiry windows at the configured boundaries", () => {
    expect(getExpiryBucket("2026-08-01", today)).toBe("expired");
    expect(getExpiryBucket("2026-08-20", today)).toBe("within_30");
    expect(getExpiryBucket("2026-09-01", today)).toBe("within_30");
    expect(getExpiryBucket("2026-10-01", today)).toBe("within_60");
    expect(getExpiryBucket("2026-10-31", today)).toBe("within_90");
    expect(getExpiryBucket("2027-01-01", today)).toBe("over_90");
    expect(getExpiryBucket(null, today)).toBe("missing");
  });

  it("checks minimum retailer shelf life", () => {
    expect(hasSufficientShelfLife("2026-12-01", 90, today)).toBe(true);
    expect(hasSufficientShelfLife("2026-09-01", 30, today)).toBe(true);
    expect(hasSufficientShelfLife("2026-09-01", 31, today)).toBe(false);
  });

  it("excludes unsafe batches and ranks eligible batches by nearest expiry", () => {
    const batches = [
      { id: "later", status: "active" as const, qualityStatus: "approved" as const, expiresOn: "2026-12-01", createdAt: "2026-01-01" },
      { id: "quarantine", status: "active" as const, qualityStatus: "quarantined" as const, expiresOn: "2026-08-20", createdAt: "2026-01-01" },
      { id: "nearest", status: "active" as const, qualityStatus: "approved" as const, expiresOn: "2026-08-20", createdAt: "2026-02-01" },
      { id: "archived", status: "archived" as const, qualityStatus: "approved" as const, expiresOn: "2026-08-10", createdAt: "2026-01-01" },
      { id: "recalled", status: "active" as const, qualityStatus: "recalled" as const, expiresOn: "2026-08-10", createdAt: "2026-01-01" },
    ];
    expect(isFefoEligible(batches[0], today)).toBe(true);
    expect(isFefoEligible(batches[1], today)).toBe(false);
    expect(rankFefo(batches, today).map((batch) => batch.id)).toEqual(["nearest", "later"]);
  });
});
