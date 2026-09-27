import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { summarizeRentMonth } from "./reminders";
import { calculateSettlements } from "./ryczaltTax";
import { deriveTasks, groupActiveTasks, rentMonthAmounts, taskNotificationPlan } from "./tasks";

const now = new Date(2026, 8, 27, 12);
const reduta: Property = {
  id: "reduta", name: "Reduta 26B/44", defaultMonthlyRent: "2700.00", expectedPaymentDay: 10,
  rentSchedule: [{ effectiveFrom: "2026-09", amount: "2700.00" }],
};
const other: Property = {
  id: "other", name: "Other", defaultMonthlyRent: "1900.00", expectedPaymentDay: 10,
  rentSchedule: [{ effectiveFrom: "2026-09", amount: "1900.00" }],
};
const receipt = (id: string, amount: string, receivedAt = "2026-09-27", propertyId = reduta.id, rentalMonth?: string): IncomeEntry => ({
  id, propertyId, amount, receivedAt, rentalMonth, taxableAmount: amount,
});
function document(entries: IncomeEntry[]) {
  return {
    schemaVersion: 4 as const, properties: [reduta, other], incomeEntries: entries, taxPayments: [], recurringBills: [],
    billPayments: [], propertyLinks: [], customReminders: [], taskStates: [],
    settings: { taxYear: 2026, settlementMode: "monthly" as const, jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
  };
}

describe("rent receipt allocation", () => {
  it("reconciles an exact payment with dashboard, income summary, task and tax", () => {
    const doc = document([receipt("exact", "2700.00")]);
    const dashboard = rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now);
    const income = summarizeRentMonth(reduta, doc.incomeEntries, "2026-09", now);
    const task = deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09");
    const tax = calculateSettlements({ entries: doc.incomeEntries, payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-27" })[8];

    expect(dashboard).toMatchObject({ expectedGrosz: 270_000, confirmedGrosz: 270_000, remainingGrosz: 0 });
    expect(income).toMatchObject({ expectedGrosz: 270_000, confirmedGrosz: 270_000, remainingGrosz: 0, status: "complete" });
    expect(task).toMatchObject({ status: "completed", remainingGrosz: 0 });
    expect(tax).toMatchObject({ revenueGrosz: 270_000, obligationGrosz: 23_000 });
  });

  it("keeps partial rent active and shows only the remaining amount", () => {
    const doc = document([receipt("partial", "1000.00")]);
    const task = deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09");
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now)).toMatchObject({ confirmedGrosz: 100_000, remainingGrosz: 170_000 });
    expect(task).toMatchObject({ status: "needs-attention", confirmedGrosz: 100_000, remainingGrosz: 170_000 });
    expect(task?.title).toContain("1 700,00 zł");
  });

  it("combines multiple receipts against the same rent expectation", () => {
    const doc = document([receipt("first", "1000.00", "2026-09-10"), receipt("second", "1700.00", "2026-09-27")]);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now)).toMatchObject({ confirmedGrosz: 270_000, remainingGrosz: 0 });
    expect(deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09")?.status).toBe("completed");
  });

  it("allocates overpayment to the next open month and reports excess beyond projected obligations", () => {
    const doc = document([receipt("over", "6500.00")]);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now).confirmedGrosz).toBe(270_000);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-10", now)).toMatchObject({ confirmedGrosz: 270_000, remainingGrosz: 0 });
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-11", now)).toMatchObject({ confirmedGrosz: 110_000, remainingGrosz: 160_000 });

    const veryLarge = document([receipt("large", "30000.00")]);
    expect(rentMonthAmounts(reduta, veryLarge.incomeEntries, "2026-09", now).unallocatedGrosz).toBe(1_110_000);
    expect(veryLarge.incomeEntries[0]?.amount).toBe("30000.00");
  });

  it("does not change another property's expectation", () => {
    const doc = document([receipt("reduta-payment", "2700.00")]);
    expect(rentMonthAmounts(other, doc.incomeEntries, "2026-09", now)).toMatchObject({ expectedGrosz: 190_000, confirmedGrosz: 0, remainingGrosz: 190_000 });
  });

  it("counts only actionable tasks while preserving future tasks in a separate upcoming group", () => {
    const doc = document([]);
    const groups = groupActiveTasks(deriveTasks(doc, now));
    expect(groups.actionable.map((task) => task.id)).toContain("TENANT_PAYMENT_CHECK:reduta:2026-09");
    expect(groups.actionable.some((task) => task.period === "2026-10")).toBe(false);
    expect(groups.upcoming.map((task) => task.id)).toContain("TENANT_PAYMENT_CHECK:reduta:2026-10");
  });

  it("keeps tasks in-app when notification category is switched off", () => {
    const doc = document([]);
    doc.properties[0]!.paymentReminderEnabled = true;
    doc.settings.reminderCategories.rent = false;
    const tasks = deriveTasks(doc, now);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:reduta:2026-09")).toBe(true);
    expect(taskNotificationPlan(doc, now).map((item) => item.key)).not.toContain("TENANT_PAYMENT_CHECK:reduta:2026-09");
  });
});
