import { describe, expect, it } from "vitest";
import { displayNameFromProfile, firstName, formatDate, formatLkr, initials } from "@/lib/utils";

describe("GoodLivin formatting helpers", () => {
  it("formats dates in the Colombo timezone", () => {
    expect(formatDate("2026-08-02T18:30:00.000Z")).toBe("Aug 3, 2026");
  });

  it("formats LKR with two decimal places when needed", () => {
    expect(formatLkr(1250.5)).toContain("1,250.50");
  });

  it("creates stable initials", () => {
    expect(initials("Amara Perera")).toBe("AP");
  });

  it("uses saved names and a neutral fallback instead of email text", () => {
    expect(displayNameFromProfile("Shavendra Rajapakse", "shavendra@example.com")).toBe("Shavendra Rajapakse");
    expect(displayNameFromProfile("shavendra", "shavendra@example.com")).toBe("Team member");
    expect(displayNameFromProfile(null, "partner@example.com", "Business Partner")).toBe("Business Partner");
    expect(displayNameFromProfile(null, "partner@example.com")).toBe("Team member");
    expect(firstName("Shavendra Rajapakse")).toBe("Shavendra");
    expect(firstName("Team member")).toBe("Team member");
  });
});
