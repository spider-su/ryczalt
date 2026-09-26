import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { deriveTasks, expectedRentForMonth, setTaskState, taskNotificationPlan } from "./tasks";

function document(): RentalDocument {
  return {
    schemaVersion: 3,
    properties: [{ id: "p1", name: "Parkowa", defaultMonthlyRent: "3000.00", expectedPaymentDay: 10,
      rentSchedule: [{ effectiveFrom: "2026-07", amount: "2500.00" }, { effectiveFrom: "2026-09", amount: "3000.00" }],
      rentalEndDate: "2026-12-31", rentalEndReminderDays: [30, 7] }],
    incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], propertyLinks: [], customReminders: [], taskStates: [],
    settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
  };
}

describe("personal assistant tasks", () => {
  it("uses explicit rent-rate history and does not invent historical expectations", () => {
    const doc = document();
    expect(expectedRentForMonth(doc.properties[0]!, "2026-08", new Date(2026, 8, 26))).toBe(250_000);
    expect(expectedRentForMonth(doc.properties[0]!, "2026-06", new Date(2026, 8, 26))).toBeNull();
    expect(expectedRentForMonth({ id: "old", name: "Old", defaultMonthlyRent: "1000.00" }, "2026-01", new Date(2026, 8, 26))).toBeNull();
  });

  it("projects stable partial-rent tasks and resolves them only after recorded receipts cover the expectation", () => {
    const doc = document();
    doc.incomeEntries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-09-12", rentalMonth: "2026-09", amount: "2000.00", taxableAmount: "2000.00" }];
    const now = new Date(2026, 8, 26, 12);
    const id = "TENANT_PAYMENT_CHECK:p1:2026-09";
    const task = deriveTasks(doc, now).find((item) => item.id === id)!;
    expect(task).toMatchObject({ status: "needs-attention", expectedGrosz: 300_000, confirmedGrosz: 200_000, remainingGrosz: 100_000 });
    expect(task.title).toContain("1 000,00 zł");
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.id).toBe(id);
    doc.incomeEntries[0]!.amount = "3000.00";
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.status).toBe("completed");
    doc.incomeEntries = [];
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.status).toBe("needs-attention");
  });

  it("classifies upcoming, snoozed, dismissed and manually completed tasks without changing due dates", () => {
    const doc = document();
    doc.customReminders = [{ id: "r1", title: "Sprawdź licznik", dueDate: "2026-10-03", propertyId: "p1" }];
    const now = new Date(2026, 8, 26, 12);
    const id = "CUSTOM_REMINDER:r1";
    expect(deriveTasks(doc, now).find((task) => task.id === id)?.status).toBe("upcoming");
    doc.taskStates = setTaskState(doc.taskStates, id, { snoozedUntil: new Date(2026, 8, 27, 9).toISOString() });
    expect(deriveTasks(doc, now).find((task) => task.id === id)?.status).toBe("snoozed");
    expect(taskNotificationPlan(doc, now).find((item) => item.key === id)?.fireAt).toEqual(new Date(2026, 8, 27, 9));
    doc.taskStates = setTaskState(doc.taskStates, id, { snoozedUntil: undefined, dismissedAt: now.toISOString() });
    expect(deriveTasks(doc, now).find((task) => task.id === id)?.status).toBe("dismissed");
    doc.taskStates = setTaskState(doc.taskStates, id, { dismissedAt: undefined, completedAt: now.toISOString() });
    expect(deriveTasks(doc, now).find((task) => task.id === id)?.status).toBe("completed");
  });

  it("derives paid bills and taxes from their actual payment records", () => {
    const doc = document();
    doc.properties[0]!.expectedPaymentDay = undefined;
    doc.incomeEntries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-01-10", rentalMonth: "2026-01", amount: "10000.00", taxableAmount: "10000.00" }];
    const taxId = "TAX_PAYMENT:2026-01";
    expect(deriveTasks(doc, new Date(2026, 8, 26)).find((task) => task.id === taxId)?.status).toBe("needs-attention");
    doc.taxPayments = [{ id: "t1", period: "2026-01", paidAt: "2026-02-20", amount: "850.00" }];
    expect(deriveTasks(doc, new Date(2026, 8, 26)).find((task) => task.id === taxId)?.status).toBe("completed");
  });
});
