import { describe, expect, it } from "vitest";
import { effectiveLifecycle, lifecycleForMonth, setApartmentLifecycle } from "./apartmentLifecycle";
import type { RentalDocument } from "../model/rental";

const document: RentalDocument = { schemaVersion: 1, properties: [{ id: "p1", address: "Parkowa 1", lifecycle: "ACTIVE" }], incomeEntries: [{ id: "i1", propertyId: "p1", receivedAt: "2026-08-10", amount: "100.00", taxableAmount: "100.00" }], taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], customReminders: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [], settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 } };

describe("apartment lifecycle", () => {
  it("treats an unspecified lifecycle as active and changes status without losing payment history", () => {
    expect(effectiveLifecycle(document.properties[0]!)).toBe("ACTIVE");
    const archived = setApartmentLifecycle(document, "p1", "ARCHIVED");
    expect(archived.properties[0]?.lifecycle).toBe("ARCHIVED");
    expect(archived.incomeEntries).toEqual(document.incomeEntries);
  });

  it("records pause and resume by effective month and keeps archive terminal", () => {
    const paused = setApartmentLifecycle(document, "p1", "PAUSED", "2026-09");
    const resumed = setApartmentLifecycle(paused, "p1", "ACTIVE", "2026-11");
    expect(lifecycleForMonth(resumed.properties[0]!, "2026-08")).toBe("ACTIVE");
    expect(lifecycleForMonth(resumed.properties[0]!, "2026-10")).toBe("PAUSED");
    expect(lifecycleForMonth(resumed.properties[0]!, "2026-11")).toBe("ACTIVE");
    const archived = setApartmentLifecycle(resumed, "p1", "ARCHIVED", "2026-12");
    expect(() => setApartmentLifecycle(archived, "p1", "ACTIVE", "2027-01")).toThrow(/cannot be reactivated/i);
    expect(archived.incomeEntries).toEqual(document.incomeEntries);
  });
});
