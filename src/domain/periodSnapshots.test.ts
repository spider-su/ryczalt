import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { closeRentalMonth, refreshSavedTaxSettlementsAfterPayment } from "./periodSnapshots";

const base = (): RentalDocument => ({
  schemaVersion: 1,
  properties: [{ id: "flat-a", address: "Parkowa", lifecycle: "ACTIVE", ownerRent: "3000.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-01", amount: "3000.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }] }],
  incomeEntries: [{ id: "receipt-sep", propertyId: "flat-a", receivedAt: "2026-09-10", rentalMonth: "2026-09", amount: "3000.00", taxableAmount: "3000.00" }],
  taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], customReminders: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
});

describe("period snapshots", () => {
  it("saves apartment and account tax results once and ignores later apartment edits", () => {
    const document = base();
    const closed = closeRentalMonth(document, "2026-09", new Date("2026-10-01T10:00:00.000Z"));
    expect(closed.apartmentPeriods?.find((snapshot) => snapshot.month === "2026-09")).toMatchObject({ propertyId: "flat-a", ownerRent: "3000.00", expectedAmount: "3000.00", confirmedAmount: "3000.00", taxableAmount: "3000.00", receiptIds: ["receipt-sep"] });
    expect(closed.taxSettlementSnapshots?.find((snapshot) => snapshot.period === "2026-09")).toMatchObject({ revenue: "3000.00", obligation: "255.00", outstanding: "255.00", rulesYear: 2026 });

    const changed = { ...closed, properties: closed.properties.map((property) => ({ ...property, ownerRent: "5000.00", rentSchedule: [{ effectiveFrom: "2026-10", amount: "5000.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }] })) };
    const closedAgain = closeRentalMonth(changed, "2026-09", new Date("2026-11-01T10:00:00.000Z"));
    expect(closedAgain.apartmentPeriods).toEqual(closed.apartmentPeriods);
    expect(closedAgain.taxSettlementSnapshots).toEqual(closed.taxSettlementSnapshots);
  });

  it("keeps archived apartment receipts in its closed period and rejects reopening by re-close", () => {
    const document = base();
    document.properties[0]!.lifecycle = "ARCHIVED";
    document.properties[0]!.lifecycleSchedule = [{ effectiveFrom: "2026-10", lifecycle: "ARCHIVED" }];
    const closed = closeRentalMonth(document, "2026-09", new Date("2026-10-01T10:00:00.000Z"));
    expect(closed.apartmentPeriods?.find((snapshot) => snapshot.month === "2026-09")?.receiptIds).toEqual(["receipt-sep"]);
    expect(closeRentalMonth(closed, "2026-09", new Date("2026-11-01T10:00:00.000Z")).apartmentPeriods).toEqual(closed.apartmentPeriods);
  });

  it("does not close the current or a future month", () => {
    expect(() => closeRentalMonth(base(), "2026-10", new Date("2026-10-01T10:00:00.000Z"))).toThrow(/completed month/i);
  });

  it("updates only payment allocation when a tax payment is confirmed after close", () => {
    const closed = closeRentalMonth(base(), "2026-09", new Date("2026-10-01T10:00:00.000Z"));
    const paid = refreshSavedTaxSettlementsAfterPayment({
      ...closed,
      taxPayments: [{ id: "tax-sep", period: "2026-09", paidAt: "2026-10-10", amount: "255.00" }],
    }, "2026-09", new Date("2026-10-10T10:00:00.000Z"));
    expect(paid.taxSettlementSnapshots?.find((snapshot) => snapshot.period === "2026-09")).toMatchObject({
      obligation: "255.00", paid: "255.00", outstanding: "0.00", taxPaymentIds: ["tax-sep"],
    });
    expect(paid.apartmentPeriods).toEqual(closed.apartmentPeriods);
  });
});
