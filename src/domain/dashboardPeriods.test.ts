import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { availableIncomeYears, currentRentalMonth, dashboardMonthsForYear, earliestDashboardMonth, shiftDashboardMonth } from "./dashboardPeriods";

const now = new Date(2026, 8, 28, 12);

describe("dashboard month periods", () => {
  it("does not navigate forward from the current month", () => {
    expect(currentRentalMonth(now)).toBe("2026-09");
    expect(shiftDashboardMonth("2026-09", 1, now)).toBe("2026-09");
    expect(dashboardMonthsForYear(2026, now)).not.toContain("2026-10");
    expect(dashboardMonthsForYear(2026, now)).not.toContain("2026-12");
  });

  it("allows a previous month to move forward only as far as the current month", () => {
    expect(shiftDashboardMonth("2026-08", 1, now)).toBe("2026-09");
    expect(shiftDashboardMonth("2026-08", 2, now)).toBe("2026-09");
  });

  it("keeps all months available in a completed historical year", () => {
    expect(dashboardMonthsForYear(2025, now)).toHaveLength(12);
    expect(dashboardMonthsForYear(2025, now).at(-1)).toBe("2025-12");
  });

  it("does not make a future year selectable", () => {
    expect(dashboardMonthsForYear(2027, now)).toEqual([]);
  });

  it("does not expose months before a mid-year rental tracking start", () => {
    const properties: Property[] = [{ id: "p1", address: "Parkowa 1", rentalStartDate: "2026-03-12",
      rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 5 }] }];
    const openingBalanceOnly: IncomeEntry[] = [];
    const earliest = earliestDashboardMonth(properties, openingBalanceOnly, now);
    expect(earliest).toBe("2026-03");
    expect(dashboardMonthsForYear(2026, now, earliest)).toEqual([
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ]);
    expect(shiftDashboardMonth("2026-02", -1, now, earliest)).toBe("2026-03");
  });
});

describe("available income years", () => {
  it("shows only the current year when no meaningful past history exists", () => {
    expect(availableIncomeYears([], [], undefined, now)).toEqual([2026]);
  });

  it("adds a previous year automatically when confirmed or imported history exists", () => {
    const historical = { id: "old", propertyId: "flat", receivedAt: "2025-12-30", amount: "700", taxableAmount: "700", source: "INITIAL_IMPORT" as const };
    expect(availableIncomeYears([], [historical], undefined, now)).toEqual([2025, 2026]);
  });

  it("does not expose empty gaps or future years", () => {
    const history = [
      { id: "old", propertyId: "flat", receivedAt: "2024-12-30", amount: "700", taxableAmount: "700" },
      { id: "future", propertyId: "flat", receivedAt: "2027-01-02", amount: "700", taxableAmount: "700" },
    ];
    expect(availableIncomeYears([], history, undefined, now)).toEqual([2024, 2026]);
  });

  it("includes opening revenue and explicit rental tracking years", () => {
    const properties: Property[] = [{ id: "flat", address: "History", rentalStartDate: "2025-04-01" }];
    expect(availableIncomeYears(properties, [], 2025, now)).toEqual([2025, 2026]);
  });
});
