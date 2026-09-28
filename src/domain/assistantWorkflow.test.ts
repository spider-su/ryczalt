import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { createIncomeEntry, editIncomeEntry, removePropertyData } from "./rentalOperations";
import { calculateSettlements } from "./ryczaltTax";
import { deriveTasks, rentMonthAmounts, taskNotificationPlan } from "./tasks";

const now = new Date(2026, 8, 26, 12);
function document(): RentalDocument {
  return {
    schemaVersion: 6,
    properties: [{ id: "p1", address: "Parkowa", tenantName: "Anna", ownerRent: "3000.00",
      rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00" }, { effectiveFrom: "2026-09", amount: "3000.00" }],
      paymentDay: 10, leaseEndDate: "2026-12-31" }],
    incomeEntries: [], taxPayments: [],
    recurringBills: [
      { id: "fixed", propertyId: "p1", name: "Czynsz administracyjny", dueDay: 5, expectedAmount: "600.00", reminderEnabled: true },
      { id: "variable", propertyId: "p1", name: "Prąd", dueDay: 15, variableAmount: true, reminderEnabled: true },
    ],
    billPayments: [], propertyLinks: [], administrationSuggestions: [], customReminders: [], taskStates: [],
    settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
  };
}

describe("assistant workflows across domain modules", () => {
  it("tracks no, partial, final, corrected, and deleted rent receipts against the historical rate", () => {
    const doc = document();
    const taskId = "TENANT_PAYMENT_CHECK:p1:2026-09";
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)).toMatchObject({ status: "needs-attention", remainingGrosz: 300_000, manuallyCompletable: false });

    const first = createIncomeEntry({ propertyId: "p1", receivedAt: "2026-10-02", amount: "2000.00", taxableAmount: "1800.00", rentalMonth: "2026-09" }, doc.properties[0]!, "i1");
    doc.incomeEntries = [first];
    expect(first.tenantNameSnapshot).toBe("Anna");
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)).toMatchObject({ remainingGrosz: 100_000, status: "needs-attention" });
    expect(rentMonthAmounts(doc.properties[0]!, doc.incomeEntries, "2026-08", now).expectedGrosz).toBe(250_000);

    const corrected = editIncomeEntry(first, { propertyId: "p1", receivedAt: "2026-10-02", amount: "3000.00", taxableAmount: "2800.00", rentalMonth: "2026-09" });
    doc.properties[0]!.tenantName = "Beata";
    doc.incomeEntries = [corrected];
    expect(corrected.tenantNameSnapshot).toBe("Anna");
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.status).toBe("completed");
    doc.incomeEntries = [];
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.status).toBe("needs-attention");
  });

  it("recalculates tax obligation and task after receipt/payment changes", () => {
    const doc = document();
    const receipt = createIncomeEntry({ propertyId: "p1", receivedAt: "2026-01-12", amount: "1000.00", taxableAmount: "1000.00", rentalMonth: "2025-12" }, doc.properties[0]!, "taxable");
    doc.incomeEntries = [receipt];
    const obligation = calculateSettlements({ entries: doc.incomeEntries, payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-26" })[0]!;
    expect(obligation.obligationGrosz).toBe(8_500);
    const taskId = "TAX_PAYMENT:2026-01";
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)).toMatchObject({ status: "needs-attention", manuallyCompletable: false, remainingGrosz: 8_500 });
    doc.incomeEntries = [editIncomeEntry(receipt, { propertyId: "p1", receivedAt: "2026-01-12", amount: "1200.00", taxableAmount: "1200.00", rentalMonth: "2025-12" })];
    expect(calculateSettlements({ entries: doc.incomeEntries, payments: [], taxYear: 2026, mode: "monthly" })[0]?.obligationGrosz).toBe(10_200);
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.remainingGrosz).toBe(10_200);
    doc.incomeEntries = [receipt];

    doc.taxPayments = [{ id: "tax", period: "2026-01", paidAt: "2026-02-20", amount: "40.00" }];
    expect(calculateSettlements({ entries: doc.incomeEntries, payments: doc.taxPayments, taxYear: 2026, mode: "monthly" })[0]).toMatchObject({ obligationGrosz: 8_500, outstandingGrosz: 4_500 });
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.remainingGrosz).toBe(4_500);
    doc.taxPayments[0]!.amount = "60.00";
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.remainingGrosz).toBe(2_500);
    doc.taxPayments[0]!.amount = "85.00";
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.status).toBe("completed");
    doc.taxPayments = [];
    expect(deriveTasks(doc, now).find((task) => task.id === taskId)?.status).toBe("needs-attention");
    doc.incomeEntries = [];
    expect(deriveTasks(doc, now).some((task) => task.id === taskId)).toBe(false);
  });

  it("projects fixed and variable bills, resolves only from recorded payment, and drops deleted bills", () => {
    const doc = document();
    const fixedId = "RECURRING_BILL:fixed:2026-09";
    const variableId = "RECURRING_BILL:variable:2026-09";
    const tasks = deriveTasks(doc, now);
    expect(tasks.find((task) => task.id === fixedId)).toMatchObject({ expectedGrosz: 60_000, manuallyCompletable: false });
    expect(tasks.find((task) => task.id === variableId)?.detail).toContain("Sprawdź bieżącą kwotę");
    expect(tasks.find((task) => task.id === fixedId)?.manuallyCompletable).toBe(false);
    doc.billPayments = [{ id: "bp", billId: "fixed", period: "2026-09", paidAt: "2026-09-20", amount: "600.00" }];
    expect(deriveTasks(doc, now).find((task) => task.id === fixedId)?.status).toBe("completed");
    doc.recurringBills = doc.recurringBills.filter((bill) => bill.id !== "variable");
    doc.billPayments = doc.billPayments.filter((payment) => payment.billId !== "variable");
    expect(deriveTasks(doc, now).some((task) => task.id.startsWith("RECURRING_BILL:variable:"))).toBe(false);
  });

  it("replaces agreement reminder keys after date edits and removes them when the date is cleared", () => {
    const doc = document();
    const oldKeys = taskNotificationPlan(doc, now).filter((item) => item.key.startsWith("RENTAL_AGREEMENT_END:")).map((item) => item.key);
    expect(oldKeys.length).toBeGreaterThan(0);
    doc.properties[0]!.leaseEndDate = "2026-12-15";
    const newPlan = taskNotificationPlan(doc, now);
    expect(newPlan.some((item) => oldKeys.includes(item.key))).toBe(false);
    expect(newPlan.some((item) => item.key.startsWith("RENTAL_AGREEMENT_END:p1:2026-12-15"))).toBe(true);
    expect(deriveTasks(doc, now).find((task) => task.id.startsWith("RENTAL_AGREEMENT_END:"))?.manuallyCompletable).toBe(true);
    doc.properties[0]!.leaseEndDate = undefined;
    expect(taskNotificationPlan(doc, now).some((item) => item.key.startsWith("RENTAL_AGREEMENT_END:"))).toBe(false);
  });

  it("deletes apartment-linked obligations safely and detaches personal reminders", () => {
    const doc = document();
    doc.propertyLinks = [{ id: "link", propertyId: "p1", label: "Media", url: "https://utility.example.test" }];
    doc.customReminders = [{ id: "r1", title: "Sprawdź licznik", propertyId: "p1", dueDate: "2026-10-01", recurrence: "ONCE" }];
    doc.taskStates = [
      { taskId: "TENANT_PAYMENT_CHECK:p1:2026-09", dismissedAt: now.toISOString() },
      { taskId: "RECURRING_BILL:fixed:2026-09", snoozedUntil: now.toISOString() },
      { taskId: "CUSTOM_REMINDER:r1", dismissedAt: now.toISOString() },
    ];
    doc.billPayments = [{ id: "bp", billId: "fixed", period: "2026-09", paidAt: "2026-09-20", amount: "600.00" }];
    const deleted = removePropertyData(doc, "p1");
    expect(deleted.properties).toHaveLength(0);
    expect(deleted.recurringBills).toHaveLength(0);
    expect(deleted.billPayments).toHaveLength(0);
    expect(deleted.propertyLinks).toHaveLength(0);
    expect(deleted.customReminders[0]).toMatchObject({ id: "r1", title: "Sprawdź licznik" });
    expect(deleted.customReminders[0]?.propertyId).toBeUndefined();
    expect(deleted.taskStates.map((state) => state.taskId)).toEqual(["CUSTOM_REMINDER:r1"]);
    expect(() => removePropertyData({ ...doc, incomeEntries: [{ id: "i", propertyId: "p1", receivedAt: "2026-01-01", amount: "1.00", taxableAmount: "1.00" }] }, "p1")).toThrow();
  });
});
