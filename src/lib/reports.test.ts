import { describe, expect, it } from "vitest";
import { csvEscape, getReportAccess } from "@/lib/reports";
import type { CurrentUser } from "@/lib/auth";

function userWithRoles(roles: CurrentUser["roles"]): CurrentUser {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "team@goodlivin.test",
    displayName: "Team member",
    roles,
    retailerId: null,
    isDemo: false,
  };
}

describe("Stage 7 report utilities", () => {
  it("escapes CSV fields that could become spreadsheet formulas", () => {
    expect(csvEscape("=IMPORTXML(\"https://example.test\")")).toBe("\"'=IMPORTXML(\"\"https://example.test\"\")\"");
    expect(csvEscape("+SUM(1,2)")).toBe("\"'+SUM(1,2)\"");
    expect(csvEscape("-10")).toBe("\"'-10\"");
    expect(csvEscape("@hidden")).toBe("\"'@hidden\"");
  });

  it("keeps financial valuation restricted away from operational roles", () => {
    const warehouseAccess = getReportAccess(userWithRoles(["warehouse_staff"]));
    expect(warehouseAccess.inventory).toBe(true);
    expect(warehouseAccess.purchasing).toBe(true);
    expect(warehouseAccess.valuation).toBe(false);
    expect(warehouseAccess.financial).toBe(false);

    const financeAccess = getReportAccess(userWithRoles(["finance_team"]));
    expect(financeAccess.valuation).toBe(true);
    expect(financeAccess.financial).toBe(true);
  });
});
