import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { deriveTasks, expectedRentForMonth, setTaskState, taskNotificationPlan } from "./tasks";

function document(): RentalDocument {
  return {
    schemaVersion: 7,
    properties: [{ id: "p1", address: "Parkowa", ownerRent: "3000.00", paymentDay: 10,
      rentSchedule: [{ effectiveFrom: "2026-07", amount: "2500.00" }, { effectiveFrom: "2026-09", amount: "3000.00" }],
      leaseEndDate: "2026-12-31" }],
    incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], propertyLinks: [], administrationSuggestions: [], customReminders: [], taskStates: [],
    settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
  };
}

describe("personal assistant tasks", () => {
  it("does not create a lease-end task without a recorded contractual date", () => {
    const withoutEnd = document();
    withoutEnd.properties = [{ id: "p-no-end", address: "Parkowa 2", paymentDay: 10 }];
    expect(deriveTasks(withoutEnd, new Date(2026, 8, 28)).some((task) => task.type === "RENTAL_AGREEMENT_END")).toBe(false);
  });
  const billTask = (doc: RentalDocument, period = "2026-09") => deriveTasks(doc, new Date(2026, 8, 26, 12)).find((item) => item.id === `RECURRING_BILL:power:${period}`)!;

  it("resolves fixed recurring bills only when period payments cover the expected amount", () => {
    const doc = document();
    doc.recurringBills = [{ id: "power", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false, expectedAmount: "600.00" }];
    expect(billTask(doc)).toMatchObject({ status: "needs-attention", expectedGrosz: 60_000, confirmedGrosz: 0, remainingGrosz: 60_000 });
    doc.billPayments = [{ id: "b1", billId: "power", period: "2026-09", paidAt: "2026-09-12", amount: "200.00" }];
    expect(billTask(doc)).toMatchObject({ status: "needs-attention", confirmedGrosz: 20_000, remainingGrosz: 40_000 });
    expect(billTask(doc).detail).toContain("pozostało 400,00 zł");
    doc.billPayments.push({ id: "b2", billId: "power", period: "2026-09", paidAt: "2026-09-18", amount: "400.00" });
    expect(billTask(doc)).toMatchObject({ status: "completed", remainingGrosz: 0 });
    doc.billPayments[1]!.amount = "500.00";
    expect(billTask(doc)).toMatchObject({ status: "completed", remainingGrosz: 0, confirmedGrosz: 70_000 });
    doc.billPayments.splice(1, 1);
    expect(billTask(doc)).toMatchObject({ status: "needs-attention", remainingGrosz: 40_000 });
  });

  it("counts only payments for the target fixed-bill period", () => {
    const doc = document();
    doc.recurringBills = [{ id: "power", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false, expectedAmount: "600.00" }];
    doc.billPayments = [{ id: "b1", billId: "power", period: "2026-08", paidAt: "2026-08-18", amount: "600.00" }];
    expect(billTask(doc)).toMatchObject({ status: "needs-attention", confirmedGrosz: 0, remainingGrosz: 60_000 });
  });

  it("does not generate rent tasks after the rental agreement end month", () => {
    const doc = document();
    doc.properties[0]!.leaseEndDate = "2026-10-15";
    const tasks = deriveTasks(doc, new Date(2026, 8, 26, 12));
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-10")).toBe(true);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-11")).toBe(false);
  });

  it("stops generating rent and related reminders while an apartment is paused, preserving history", () => {
    const doc = document();
    doc.properties[0]!.lifecycle = "PAUSED";
    doc.incomeEntries = [{ id: "paid", propertyId: "p1", receivedAt: "2026-09-10", rentalMonth: "2026-09", amount: "3000.00", taxableAmount: "3000.00" }];
    const tasks = deriveTasks(doc, new Date(2026, 8, 26, 12));
    expect(tasks.some((task) => task.type === "TENANT_PAYMENT_CHECK" || task.type === "RENTAL_AGREEMENT_END")).toBe(false);
    expect(doc.incomeEntries).toHaveLength(1);
  });

  it("applies the global rent reminder delay to reminder time, not the due date", () => {
    const doc = document();
    doc.settings.rentReminderDelayDays = 3;
    const task = deriveTasks(doc, new Date(2026, 8, 26, 12)).find((item) => item.id === "TENANT_PAYMENT_CHECK:p1:2026-09")!;
    expect(task.dueAt).toEqual(new Date(2026, 8, 10, 9));
    expect(task.notificationAt).toEqual(new Date(2026, 8, 13, 9));
  });

  it("keeps variable bills amount-free and resolves them after one payment in the target period", () => {
    const doc = document();
    doc.recurringBills = [{ id: "power", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false, variableAmount: true, expectedAmount: "600.00" }];
    expect(billTask(doc)).toMatchObject({ status: "needs-attention" });
    expect(billTask(doc).expectedGrosz).toBeUndefined();
    expect(billTask(doc).detail).toContain("Sprawdź bieżącą kwotę.");
    doc.billPayments = [{ id: "b1", billId: "power", period: "2026-08", paidAt: "2026-08-18", amount: "650.00" }];
    expect(billTask(doc).status).toBe("needs-attention");
    doc.billPayments[0]!.period = "2026-09";
    expect(billTask(doc).status).toBe("completed");
  });

  it("uses explicit rent-rate history and does not invent historical expectations", () => {
    const doc = document();
    expect(expectedRentForMonth(doc.properties[0]!, "2026-08", new Date(2026, 8, 26))).toBe(250_000);
    expect(expectedRentForMonth(doc.properties[0]!, "2026-06", new Date(2026, 8, 26))).toBeNull();
    expect(expectedRentForMonth({ id: "old", address: "Old", ownerRent: "1000.00" }, "2026-01", new Date(2026, 8, 26))).toBeNull();
  });

  it("projects stable partial-rent tasks and resolves them only after recorded receipts cover the expectation", () => {
    const doc = document();
    doc.incomeEntries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-09-12", rentalMonth: "2026-09", amount: "2000.00", taxableAmount: "2000.00" }];
    const now = new Date(2026, 8, 26, 12);
    const id = "TENANT_PAYMENT_CHECK:p1:2026-09";
    const task = deriveTasks(doc, now).find((item) => item.id === id)!;
    expect(task).toMatchObject({ status: "needs-attention", expectedGrosz: 300_000, confirmedGrosz: 200_000, remainingGrosz: 100_000 });
    expect(task.title).toBe("Sprawdź czynsz — Parkowa");
    expect(task.detail).toContain("do potwierdzenia 1 000,00 zł");
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.id).toBe(id);
    doc.incomeEntries[0]!.amount = "3000.00";
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.status).toBe("completed");
    doc.incomeEntries = [];
    expect(deriveTasks(doc, now).find((item) => item.id === id)?.status).toBe("needs-attention");
  });

  it("uses the target month expected rent for upcoming rent after a large September receipt", () => {
    const doc = document();
    doc.properties[0] = { ...doc.properties[0]!, address: "Reduta 26B", ownerRent: "2600.00",
      rentSchedule: [{ effectiveFrom: "2026-09", amount: "2600.00" }] };
    doc.incomeEntries = [{ id: "sep-overpayment", propertyId: "p1", receivedAt: "2026-09-27", rentalMonth: "2026-09", amount: "10000.00", taxableAmount: "10000.00" }];
    const october = deriveTasks(doc, new Date(2026, 8, 27, 12)).find((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-10");
    expect(october).toMatchObject({ title: "Sprawdź czynsz — Reduta 26B", expectedGrosz: 260_000, confirmedGrosz: 0, remainingGrosz: 260_000, status: "upcoming" });
  });

  it("classifies upcoming, snoozed, dismissed and manually completed tasks without changing due dates", () => {
    const doc = document();
    doc.customReminders = [{ id: "r1", title: "Sprawdź licznik", dueDate: "2026-10-03", propertyId: "p1", recurrence: "ONCE" }];
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
    doc.properties[0]!.paymentDay = undefined;
    doc.incomeEntries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-01-10", rentalMonth: "2026-01", amount: "10000.00", taxableAmount: "10000.00" }];
    const taxId = "TAX_PAYMENT:2026-01";
    expect(deriveTasks(doc, new Date(2026, 8, 26)).find((task) => task.id === taxId)?.status).toBe("needs-attention");
    doc.taxPayments = [{ id: "t1", period: "2026-01", paidAt: "2026-02-20", amount: "850.00" }];
    expect(deriveTasks(doc, new Date(2026, 8, 26)).find((task) => task.id === taxId)?.status).toBe("completed");
  });

  it("keeps rent and bill tasks in-app while honoring their notification switches", () => {
    const doc = document();
    doc.recurringBills = [{ id: "electricity", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false }];
    const now = new Date(2026, 8, 26, 12);
    const tasks = deriveTasks(doc, now);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-09")).toBe(true);
    expect(tasks.some((task) => task.id === "RECURRING_BILL:electricity:2026-09")).toBe(true);
    const plan = taskNotificationPlan(doc, now);
    expect(plan.some((item) => item.key === "TENANT_PAYMENT_CHECK:p1:2026-09")).toBe(false);
    expect(plan.some((item) => item.key === "RECURRING_BILL:electricity:2026-09")).toBe(false);
  });

  it("includes the bill month in the scheduled notification payload", () => {
    const doc = document();
    doc.recurringBills = [{ id: "power", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: true }];
    const notification = taskNotificationPlan(doc, new Date(2026, 8, 26, 12)).find((item) => item.key === "RECURRING_BILL:power:2026-10");
    expect(notification?.data).toMatchObject({ category: "bill", billId: "power", period: "2026-10" });
  });
});
