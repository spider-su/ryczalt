import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { deriveTasks, expectedRentForMonth, taskNotificationPlan } from "./tasks";

function document(): RentalDocument {
  return {
    schemaVersion: 1,
    properties: [{ id: "p1", address: "Parkowa", ownerRent: "3000.00", paymentDay: 10,
      rentSchedule: [{ effectiveFrom: "2026-07", amount: "2500.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 10 }, { effectiveFrom: "2026-09", amount: "3000.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 10 }],
      leaseEndDate: "2026-12-31" }],
    incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], customReminders: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [],
    settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
  };
}

describe("personal assistant tasks", () => {
  it("does not create a lease-end task without a recorded contractual date", () => {
    const withoutEnd = document();
    withoutEnd.properties = [{ id: "p-no-end", address: "Parkowa 2", paymentDay: 10 }];
    expect(deriveTasks(withoutEnd, new Date(2026, 8, 28)).some((task) => task.type === "RENTAL_AGREEMENT_END")).toBe(false);
  });

  it("uses the saved tax period when deriving reminders instead of recalculating it", () => {
    const doc = document();
    doc.incomeEntries = [{ id: "newer", propertyId: "p1", receivedAt: "2026-09-10", amount: "9000.00", taxableAmount: "9000.00" }];
    doc.taxSettlementSnapshots = [{
      period: "2026-09", revenue: "1000.00", taxableBase: "1000.00", cumulativeRevenue: "1000.00", cumulativeTax: "85.00",
      obligation: "85.00", paid: "0.00", allocatedPaid: "0.00", creditApplied: "0.00", outstanding: "85.00", overpaid: "0.00",
      dueDate: "2026-10-20", rulesYear: 2026, receiptIds: [], taxPaymentIds: [], savedAt: "2026-10-01T00:00:00.000Z",
    }];
    const task = deriveTasks(doc, new Date(2026, 9, 1)).find((item) => item.id === "TAX_PAYMENT:2026-09");
    expect(task).toMatchObject({ expectedGrosz: 8500, remainingGrosz: 8500 });
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

  it("ignores legacy bills and custom reminders while retaining rental tasks", () => {
    const doc = document();
    doc.recurringBills = [{ id: "power", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false, variableAmount: true, expectedAmount: "600.00" }];
    doc.customReminders = [{ id: "r1", title: "Polisa", dueDate: "2026-10-15", recurrence: "ONCE" }];
    const tasks = deriveTasks(doc, new Date(2026, 8, 26, 12));
    expect(tasks.some((item) => item.id.startsWith("RECURRING_BILL:") || item.id.startsWith("CUSTOM_REMINDER:"))).toBe(false);
    expect(tasks.some((item) => item.type === "TENANT_PAYMENT_CHECK")).toBe(true);
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
      rentSchedule: [{ effectiveFrom: "2026-09", amount: "2600.00", mediaAmount: "0.00", taxableTreatment: "OWNER_RENT", paymentDay: 10 }] };
    doc.incomeEntries = [{ id: "sep-overpayment", propertyId: "p1", receivedAt: "2026-09-27", rentalMonth: "2026-09", amount: "10000.00", taxableAmount: "10000.00" }];
    const october = deriveTasks(doc, new Date(2026, 8, 27, 12)).find((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-10");
    expect(october).toMatchObject({ title: "Sprawdź czynsz — Reduta 26B", expectedGrosz: 260_000, confirmedGrosz: 0, remainingGrosz: 260_000, status: "upcoming" });
  });

  it("does not recreate tasks from legacy personal-reminder completion state", () => {
    const doc = document();
    doc.customReminders = [{ id: "r1", title: "Sprawdź licznik", dueDate: "2026-10-15", propertyId: "p1", recurrence: "ONCE" }];
    doc.taskStates = [{ taskId: "CUSTOM_REMINDER:r1:2026-10-15", completedAt: "2026-10-01T08:00:00.000Z" }];
    expect(deriveTasks(doc, new Date(2026, 8, 26, 12)).some((task) => task.id.startsWith("CUSTOM_REMINDER:"))).toBe(false);
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

  it("keeps rent tasks while ignoring persisted legacy bill reminders", () => {
    const doc = document();
    doc.recurringBills = [{ id: "electricity", propertyId: "p1", name: "Prąd", dueDay: 10, reminderEnabled: false }];
    const now = new Date(2026, 8, 26, 12);
    const tasks = deriveTasks(doc, now);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-09")).toBe(true);
    expect(tasks.some((task) => task.id.startsWith("RECURRING_BILL:"))).toBe(false);
    const plan = taskNotificationPlan(doc, now);
    expect(plan.some((item) => item.key === "TENANT_PAYMENT_CHECK:p1:2026-09")).toBe(false);
    expect(plan.some((item) => item.key.startsWith("RECURRING_BILL:"))).toBe(false);
  });
  it("keeps calculated future tax tasks when earlier periods have snapshots", () => {
    const doc = document();
    doc.incomeEntries = [
      { id: "sep", propertyId: "p1", receivedAt: "2026-09-10", rentalMonth: "2026-09", amount: "3000.00", taxableAmount: "3000.00" },
      { id: "oct", propertyId: "p1", receivedAt: "2026-10-10", rentalMonth: "2026-10", amount: "3000.00", taxableAmount: "3000.00" },
    ];
    doc.taxSettlementSnapshots = [{
      period: "2026-09", revenue: "3000.00", taxableBase: "3000.00", cumulativeRevenue: "3000.00", cumulativeTax: "255.00",
      obligation: "255.00", paid: "0.00", allocatedPaid: "0.00", creditApplied: "0.00", outstanding: "255.00", overpaid: "0.00",
      dueDate: "2026-10-20", rulesYear: 2026, receiptIds: ["sep"], taxPaymentIds: [], savedAt: "2026-10-01T00:00:00.000Z",
    }];
    const tasks = deriveTasks(doc, new Date(2026, 9, 15, 12));
    expect(tasks.some((task) => task.id === "TAX_PAYMENT:2026-09")).toBe(true);
    expect(tasks.some((task) => task.id === "TAX_PAYMENT:2026-10")).toBe(true);
  });

  it("uses lifecycle state for each target month instead of the property's future state", () => {
    const doc = document();
    doc.properties[0] = {
      ...doc.properties[0]!,
      lifecycle: "PAUSED",
      lifecycleSchedule: [{ effectiveFrom: "2026-10", lifecycle: "PAUSED" }],
    };
    const tasks = deriveTasks(doc, new Date(2026, 8, 20, 12));
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-09")).toBe(true);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:p1:2026-10")).toBe(false);
  });

});
