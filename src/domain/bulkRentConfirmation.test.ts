import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { expectedRentForMonth } from "./rentAllocation";
import { bulkRentItems, bulkSelectionTotal, defaultBulkSelection, makeBulkRentEntries, shiftRentalMonth, toggleBulkSelection } from "./bulkRentConfirmation";

const now = new Date("2026-09-28T12:00:00");
const apartments: Property[] = [
  { id: "paid", address: "Reduta 26B / 44", ownerRent: "3610.00", paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-01", amount: "3610.00" }] },
  { id: "partial", address: "Lublańska 13 / 134", ownerRent: "3760.00", paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-01", amount: "3760.00" }], mediaPaidByTenant: true, mediaAmount: "200.00" },
  { id: "unpaid", address: "Lublańska 13 / 168", ownerRent: "3900.00", paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-01", amount: "3900.00" }] },
];
const priorEntries: IncomeEntry[] = [
  { id: "p1", propertyId: "paid", receivedAt: "2026-09-05", rentalMonth: "2026-09", amount: "3610.00", taxableAmount: "3610.00" },
  { id: "partial-1", propertyId: "partial", receivedAt: "2026-09-05", rentalMonth: "2026-09", amount: "1000.00", taxableAmount: "1000.00" },
];

describe("bulk rent confirmation", () => {
  it("lists only unpaid remainder for the requested business month and supports period navigation", () => {
    expect(bulkRentItems(apartments, priorEntries, "2026-09", now).map(({ propertyId, amountGrosz }) => [propertyId, amountGrosz])).toEqual([
      ["partial", 296_000], ["unpaid", 390_000],
    ]);
    expect(bulkRentItems(apartments, priorEntries, "2026-10", now)).toEqual([]);
    expect(expectedRentForMonth(apartments[2]!, "2026-10", now)).toBe(390_000);
    expect(shiftRentalMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftRentalMonth("2026-01", -1)).toBe("2025-12");
  });

  it("selects all by default, supports deselect/select all, and recalculates amount", () => {
    const items = bulkRentItems(apartments, priorEntries, "2026-09", now);
    const all = defaultBulkSelection(items);
    expect(all).toEqual(["partial", "unpaid"]);
    expect(bulkSelectionTotal(items, all)).toBe(686_000);
    const oneLeft = toggleBulkSelection(all, "unpaid");
    expect(oneLeft).toEqual(["partial"]);
    expect(bulkSelectionTotal(items, oneLeft)).toBe(296_000);
    expect(toggleBulkSelection(oneLeft, "unpaid")).toEqual(all);
    expect(bulkSelectionTotal(items, [])).toBe(0);
  });

  it("writes only selected rents once, retains the shared receipt date, and excludes tenant media from taxable income", () => {
    const entries = makeBulkRentEntries({ properties: apartments, priorEntries, selectedPropertyIds: ["partial"],
      rentalMonth: "2026-09", receivedAt: "2026-09-28", now, createId: () => "bulk-1" });
    expect(entries).toEqual([expect.objectContaining({ id: "bulk-1", propertyId: "partial", receivedAt: "2026-09-28",
      rentalMonth: "2026-09", amount: "2960.00", taxableAmount: "2760.00" })]);
    expect(makeBulkRentEntries({ properties: apartments, priorEntries: [...priorEntries, ...entries], selectedPropertyIds: ["partial"],
      rentalMonth: "2026-09", receivedAt: "2026-09-28", now, createId: () => "duplicate" })).toEqual([]);
  });
});
