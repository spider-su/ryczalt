import { describe, expect, it } from "vitest";
import type { RentalDocument, TaxPayment } from "../model/rental";
import { removeTaxPayment, upsertTaxPayment } from "./taxPayment";

const document: RentalDocument = {
  schemaVersion: 6,
  properties: [{ id: "p1", address: "Mieszkanie" }],
  incomeEntries: [{ id: "i1", propertyId: "p1", receivedAt: "2026-01-10", amount: "1000.00", taxableAmount: "1000.00" }],
  taxPayments: [{ id: "t1", period: "2026-01", paidAt: "2026-02-10", amount: "50.00" }],
  recurringBills: [], billPayments: [], propertyLinks: [], administrationSuggestions: [], customReminders: [], taskStates: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
};

describe("tax payment mutations", () => {
  it("adds or edits only the confirmed tax payment records", () => {
    const incomeBefore = structuredClone(document.incomeEntries);
    const added: TaxPayment = { id: "t2", period: "2026-02", paidAt: "2026-03-10", amount: "20.00" };
    const withAdded = upsertTaxPayment(document, added);
    expect(withAdded.taxPayments).toHaveLength(2);
    expect(withAdded.incomeEntries).toEqual(incomeBefore);
    const edited = upsertTaxPayment(withAdded, { ...added, amount: "25.00" });
    expect(edited.taxPayments.find((payment) => payment.id === "t2")?.amount).toBe("25.00");
    expect(edited.incomeEntries).toEqual(incomeBefore);
  });

  it("removes a tax payment without changing income", () => {
    const result = removeTaxPayment(document, "t1");
    expect(result.taxPayments).toEqual([]);
    expect(result.incomeEntries).toEqual(document.incomeEntries);
  });
});
