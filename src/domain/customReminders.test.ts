import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { deriveTasks } from "./tasks";
import { validateRentalDocumentShape } from "./rentalValidation";

describe("removed feature compatibility", () => {
  it("loads legacy bill and custom-reminder fields without surfacing removed tasks", () => {
    const legacy = {
      schemaVersion: 1,
      properties: [{ id: "p1", address: "Parkowa 1" }],
      incomeEntries: [],
      taxPayments: [],
      recurringBills: [{ id: "b1", propertyId: "p1", name: "Prąd", variableAmount: true }],
      billPayments: [],
      administrationSuggestions: [],
      customReminders: [{ id: "r1", title: "Polisa", dueDate: "2026-10-15", recurrence: "ONCE" }],
      taskStates: [],
      apartmentPeriods: [],
      taxSettlementSnapshots: [],
      settings: {
        taxYear: 2026,
        settlementMode: "monthly",
        jointSpouseThreshold: false,
        reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true },
        rentReminderDelayDays: 1,
      },
    };

    const document = validateRentalDocumentShape(legacy as unknown as RentalDocument);
    expect(document.recurringBills).toHaveLength(1);
    expect(document.customReminders).toHaveLength(1);
    expect(deriveTasks(document, new Date("2026-10-01T12:00:00.000Z"))).toEqual([]);
  });
});
