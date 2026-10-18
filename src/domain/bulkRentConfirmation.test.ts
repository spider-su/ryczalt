import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { expectedRentForMonth } from "./rentAllocation";
import { bulkRentItems, bulkSelectionTotal, defaultBulkSelection, makeBulkRentEntries, shiftRentalMonth, toggleBulkSelection } from "./bulkRentConfirmation";

const now = new Date("2026-09-28T12:00:00");
const apartments: Property[] = [
  { id: "paid", address: "Reduta 26B / 44", ownerRent: "3610.00", paymentDay: 5, taxableTreatment: "OWNER_RENT", rentSchedule: [{ effectiveFrom: "2026-01", amount: "3610.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 5 }] },
  { id: "unpaid", address: "Lublańska 13 / 168", ownerRent: "3900.00", paymentDay: 5, taxableTreatment: "OWNER_RENT", rentSchedule: [{ effectiveFrom: "2026-01", amount: "3900.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 5 }] },
];
const priorEntries: IncomeEntry[] = [
  { id: "p1", propertyId: "paid", receivedAt: "2026-09-05", rentalMonth: "2026-09", amount: "3610.00", taxableAmount: "3610.00" },
];

describe("bulk rent confirmation", () => {
  it("lists only wholly unconfirmed rent for the requested business month and supports period navigation", () => {
    expect(bulkRentItems(apartments, priorEntries, "2026-09", now).map(({ propertyId, amountGrosz }) => [propertyId, amountGrosz])).toEqual([
      ["unpaid", 390_000],
    ]);
    expect(bulkRentItems(apartments, priorEntries, "2026-10", now)).toEqual([]);
    expect(expectedRentForMonth(apartments[1]!, "2026-10", now)).toBe(390_000);
    expect(shiftRentalMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftRentalMonth("2026-01", -1)).toBe("2025-12");
  });

  it("selects all by default, supports deselect/select all, and recalculates amount", () => {
    const items = bulkRentItems(apartments, priorEntries, "2026-09", now);
    const all = defaultBulkSelection(items);
    expect(all).toEqual(["unpaid"]);
    expect(bulkSelectionTotal(items, all)).toBe(390_000);
    const oneLeft = toggleBulkSelection(all, "unpaid");
    expect(oneLeft).toEqual([]);
    expect(bulkSelectionTotal(items, oneLeft)).toBe(0);
    expect(toggleBulkSelection(oneLeft, "unpaid")).toEqual(all);
    expect(bulkSelectionTotal(items, [])).toBe(0);
  });

  it("writes only selected rents once with today's date and excludes tenant media from taxable income", () => {
    const entries = makeBulkRentEntries({ properties: apartments, priorEntries, selectedPropertyIds: ["unpaid"],
      rentalMonth: "2026-09", now, createId: () => "bulk-1" });
    expect(entries).toEqual([expect.objectContaining({ id: "bulk-1", propertyId: "unpaid", receivedAt: "2026-09-28",
      rentalMonth: "2026-09", amount: "3900.00", taxableAmount: "3900.00" })]);
    expect(makeBulkRentEntries({ properties: apartments, priorEntries: [...priorEntries, ...entries], selectedPropertyIds: ["unpaid"],
      rentalMonth: "2026-09", now, createId: () => "duplicate" })).toEqual([]);
  });

  it("uses the explicit include-charges tax treatment for bulk receipts regardless of media responsibility", () => {
    const configured = apartments.map((property) => property.id === "unpaid"
      ? { ...property, taxableTreatment: "RENT_AND_CHARGES" as const, rentSchedule: property.rentSchedule?.map((rate) => ({ ...rate, taxableTreatment: "RENT_AND_CHARGES" as const })) }
      : property);
    const entries = makeBulkRentEntries({ properties: configured, priorEntries, selectedPropertyIds: ["unpaid"],
      rentalMonth: "2026-09", now, createId: () => "bulk-charges" });
    expect(entries[0]).toMatchObject({ amount: "3900.00", taxableAmount: "3900.00" });
  });
});
