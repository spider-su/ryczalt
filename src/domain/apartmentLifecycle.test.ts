import { describe, expect, it } from "vitest";
import { effectiveLifecycle, setApartmentLifecycle } from "./apartmentLifecycle";
import type { RentalDocument } from "../model/rental";

const document: RentalDocument = { schemaVersion: 6, properties: [{ id: "p1", address: "Parkowa 1" }], incomeEntries: [{ id: "i1", propertyId: "p1", receivedAt: "2026-08-10", amount: "100.00", taxableAmount: "100.00" }], taxPayments: [], recurringBills: [], billPayments: [], propertyLinks: [], administrationSuggestions: [], customReminders: [], taskStates: [], settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 } };

describe("apartment lifecycle", () => {
  it("defaults legacy properties to active and changes status without losing payment history", () => {
    expect(effectiveLifecycle(document.properties[0]!)).toBe("ACTIVE");
    const archived = setApartmentLifecycle(document, "p1", "ARCHIVED");
    expect(archived.properties[0]?.lifecycle).toBe("ARCHIVED");
    expect(archived.incomeEntries).toEqual(document.incomeEntries);
  });
});
