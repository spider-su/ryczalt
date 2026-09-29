import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { ownerCashflowSummary } from "./ownerCashflow";

const property: Property = {
  id: "flat",
  address: "Reduta",
  rentSchedule: [{
    effectiveFrom: "2026-01",
    amount: "3000.00",
    mediaAmount: "500.00",
    mediaPaidByTenant: true,
    taxableTreatment: "OWNER_RENT",
    paymentDay: 5,
  }],
};

const receipt = (id: string, amount: string, receivedAt: string): IncomeEntry => ({
  id,
  propertyId: "flat",
  amount,
  taxableAmount: amount,
  receivedAt,
  rentalMonth: "2026-09",
});

describe("owner cashflow summary", () => {
  it("subtracts contractual tenant-paid charges and tax from confirmed cash", () => {
    const entries = [receipt("rent", "3500.00", "2026-09-05")];
    expect(ownerCashflowSummary({ entries, selectedEntries: entries, properties: [property], taxGrosz: 25_500 })).toEqual({
      receivedGrosz: 350_000,
      chargesGrosz: 50_000,
      taxGrosz: 25_500,
      ownerNetGrosz: 274_500,
      chargesKnown: true,
    });
  });

  it("allocates split receipts to owner rent first and charges second", () => {
    const first = receipt("first", "2000.00", "2026-09-05");
    const second = receipt("second", "1500.00", "2026-09-10");
    const entries = [second, first];
    expect(ownerCashflowSummary({ entries, selectedEntries: [first], properties: [property], taxGrosz: 0 }).chargesGrosz).toBe(0);
    expect(ownerCashflowSummary({ entries, selectedEntries: [second], properties: [property], taxGrosz: 0 }).chargesGrosz).toBe(50_000);
  });

  it("does not classify an overpayment above monthly terms as charges", () => {
    const entries = [receipt("over", "4000.00", "2026-09-05")];
    const summary = ownerCashflowSummary({ entries, selectedEntries: entries, properties: [property], taxGrosz: 0 });
    expect(summary.chargesGrosz).toBe(50_000);
    expect(summary.ownerNetGrosz).toBe(350_000);
  });

  it("reports charges as unknown instead of inventing historical terms", () => {
    const entries = [receipt("legacy", "3500.00", "2025-09-05")];
    const summary = ownerCashflowSummary({ entries, selectedEntries: entries, properties: [{ id: "flat", address: "Reduta" }], taxGrosz: 0 });
    expect(summary.chargesKnown).toBe(false);
    expect(summary.chargesGrosz).toBe(0);
  });
});
