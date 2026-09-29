import { describe, expect, it } from "vitest";
import { defaultTaxableAmountGrosz, tenantMonthlyTotalGrosz } from "./apartmentPayments";
import type { IncomeEntry, Property } from "../model/rental";

const property: Property = { id: "p1", address: "Parkowa 1", ownerRent: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT",
  rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT", paymentDay: 5 }] };
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

  it("keeps a manual taxable-base override local to that receipt", () => {
    const customLower = entry("1000.00", "500.00");
    expect(defaultTaxableAmountGrosz({
      property,
      amountGrosz: 200_000,
      rentalMonth: "2026-09",
      priorEntries: [customLower],
    })).toBe(150_000);

    const customHigher = entry("1000.00", "1500.00");
    expect(defaultTaxableAmountGrosz({
      property,
      amountGrosz: 200_000,
      rentalMonth: "2026-09",
      priorEntries: [customHigher],
    })).toBe(150_000);
  });

  it("does not resurrect taxable owner rent after a full receipt with a custom base", () => {
    const fullReceiptWithOverride = entry("3000.00", "2000.00");
    expect(defaultTaxableAmountGrosz({
      property,
      amountGrosz: 500_00,
      rentalMonth: "2026-09",
      priorEntries: [fullReceiptWithOverride],
    })).toBe(0);
  });

  it("uses the tax-base choice independently of who pays media", () => {
    const includeCharges = { ...property, mediaPaidByTenant: false, taxableTreatment: "RENT_AND_CHARGES" as const, rentSchedule: property.rentSchedule?.map((rate) => ({ ...rate, taxableTreatment: "RENT_AND_CHARGES" as const })) };
    expect(defaultTaxableAmountGrosz({ property: includeCharges, amountGrosz: 300_000, rentalMonth: "2026-09", priorEntries: [] })).toBe(300_000);
    const ownerOnly = { ...property, mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT" as const, rentSchedule: property.rentSchedule?.map((rate) => ({ ...rate, taxableTreatment: "OWNER_RENT" as const })) };
    expect(defaultTaxableAmountGrosz({ property: ownerOnly, amountGrosz: 300_000, rentalMonth: "2026-09", priorEntries: [] })).toBe(250_000);
  });

  it("requires explicit treatment instead of inferring from the media toggle", () => {
    expect(() => defaultTaxableAmountGrosz({ property: { ...property, taxableTreatment: undefined, rentSchedule: property.rentSchedule?.map((rate) => ({ ...rate, taxableTreatment: undefined })) }, amountGrosz: 300_000, rentalMonth: "2026-09", priorEntries: [] })).toThrow("Choose the taxable rent treatment");
  });
});
