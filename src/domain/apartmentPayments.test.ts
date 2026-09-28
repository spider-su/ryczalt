import { describe, expect, it } from "vitest";
import { defaultTaxableAmountGrosz, tenantMonthlyTotalGrosz } from "./apartmentPayments";
import type { IncomeEntry, Property } from "../model/rental";

const property: Property = { id: "p1", address: "Parkowa 1", ownerRent: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true,
  rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00" }] };
const entry = (amount: string, taxableAmount: string): IncomeEntry => ({ id: `${amount}-${taxableAmount}`, propertyId: "p1", receivedAt: "2026-09-10", rentalMonth: "2026-09", amount, taxableAmount });

describe("apartment payment amounts", () => {
  it("includes tenant-paid media in the tenant total", () => {
    expect(tenantMonthlyTotalGrosz(property)).toBe(300_000);
    expect(tenantMonthlyTotalGrosz({ ...property, mediaPaidByTenant: false })).toBe(250_000);
  });

  it("caps default taxable receipts at the owner's rent across partial confirmations", () => {
    expect(defaultTaxableAmountGrosz({ property, amountGrosz: 100_000, rentalMonth: "2026-09", priorEntries: [] })).toBe(100_000);
    expect(defaultTaxableAmountGrosz({ property, amountGrosz: 250_000, rentalMonth: "2026-09", priorEntries: [entry("1000.00", "1000.00")] })).toBe(150_000);
    expect(defaultTaxableAmountGrosz({ property, amountGrosz: 100_000, rentalMonth: "2026-09", priorEntries: [entry("2500.00", "2500.00")] })).toBe(0);
  });

  it("preserves the legacy all-taxable default when media is not tenant-paid", () => {
    const ownerPaid = { ...property, mediaPaidByTenant: false };
    expect(defaultTaxableAmountGrosz({ property: ownerPaid, amountGrosz: 300_000, rentalMonth: "2026-09", priorEntries: [] })).toBe(300_000);
  });
});
