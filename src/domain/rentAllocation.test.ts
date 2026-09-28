import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { allocateRentReceipts } from "./rentAllocation";
import { summarizeRentMonth } from "./reminders";
import { calculateSettlements } from "./ryczaltTax";
import { deriveTasks, groupActiveTasks, rentMonthAmounts, taskNotificationPlan } from "./tasks";

const now = new Date(2026, 8, 27, 12);
const reduta: Property = {
  id: "reduta", address: "Reduta 26B/44", ownerRent: "2700.00", mediaAmount: "500.00", mediaPaidByTenant: true, paymentDay: 10,
  rentSchedule: [{ effectiveFrom: "2026-09", amount: "2700.00" }],
};
const other: Property = {
  id: "other", address: "Other", ownerRent: "1900.00", paymentDay: 10,
  rentSchedule: [{ effectiveFrom: "2026-09", amount: "1900.00" }],
};
const receipt = (id: string, amount: string, receivedAt = "2026-09-27", propertyId = reduta.id, rentalMonth?: string): IncomeEntry => ({
  id, propertyId, amount, receivedAt, rentalMonth, taxableAmount: amount,
});
function document(entries: IncomeEntry[]) {
  return {
    schemaVersion: 6 as const, properties: [reduta, other], incomeEntries: entries, taxPayments: [], recurringBills: [],
    billPayments: [], propertyLinks: [], administrationSuggestions: [], customReminders: [], taskStates: [],
    settings: { taxYear: 2026, settlementMode: "monthly" as const, jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
  };
}

describe("rent receipt allocation", () => {
  it("expects the tenant total while keeping media out of the taxable owner amount", () => {
    expect(rentMonthAmounts(reduta, [], "2026-09", now).expectedGrosz).toBe(320_000);
  });

  it("does not create expectations before a recorded rental start month", () => {
    const startedInMarch = { ...reduta, rentalStartDate: "2026-03-12", rentSchedule: [{ effectiveFrom: "2026-03", amount: "2700.00" }] };
    expect(rentMonthAmounts(startedInMarch, [], "2026-02", now).expectedGrosz).toBeNull();
    expect(rentMonthAmounts(startedInMarch, [], "2026-03", now).expectedGrosz).toBe(320_000);
  });

  it("reconciles an exact payment with dashboard, income summary, task and tax", () => {
    const doc = document([{ ...receipt("exact", "3200.00"), taxableAmount: "2700.00" }]);
    const dashboard = rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now);
    const income = summarizeRentMonth(reduta, doc.incomeEntries, "2026-09", now);
    const task = deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09");
    const tax = calculateSettlements({ entries: doc.incomeEntries, payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-27" })[8];

    expect(dashboard).toMatchObject({ expectedGrosz: 320_000, confirmedGrosz: 320_000, remainingGrosz: 0 });
    expect(income).toMatchObject({ expectedGrosz: 320_000, confirmedGrosz: 320_000, remainingGrosz: 0, status: "complete" });
    expect(task).toMatchObject({ status: "completed", remainingGrosz: 0 });
    expect(tax).toMatchObject({ revenueGrosz: 270_000, obligationGrosz: 23_000 });
  });

  it("keeps partial rent active and shows only the remaining amount", () => {
    const doc = document([receipt("partial", "1000.00")]);
    const task = deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09");
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now)).toMatchObject({ confirmedGrosz: 100_000, remainingGrosz: 220_000 });
    expect(task).toMatchObject({ status: "needs-attention", confirmedGrosz: 100_000, remainingGrosz: 220_000 });
    expect(task?.title).toBe("Sprawdź czynsz — Reduta 26B/44");
    expect(task?.detail).toContain("do potwierdzenia 2 200,00 zł");
  });

  it("combines multiple receipts against the same rent expectation", () => {
    const doc = document([receipt("first", "1000.00", "2026-09-10"), receipt("second", "2200.00", "2026-09-27")]);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now)).toMatchObject({ confirmedGrosz: 320_000, remainingGrosz: 0 });
    expect(deriveTasks(doc, now).find((item) => item.id === "TENANT_PAYMENT_CHECK:reduta:2026-09")?.status).toBe("completed");
  });

  it("keeps rent overpayment unallocated instead of prepaying future months", () => {
    const doc = document([receipt("over", "6500.00")]);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now).confirmedGrosz).toBe(320_000);
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-10", now)).toMatchObject({ confirmedGrosz: 0, remainingGrosz: 320_000 });
    expect(rentMonthAmounts(reduta, doc.incomeEntries, "2026-09", now).unallocatedGrosz).toBe(330_000);

    const veryLarge = document([receipt("large", "30000.00")]);
    expect(rentMonthAmounts(reduta, veryLarge.incomeEntries, "2026-09", now).unallocatedGrosz).toBe(2_680_000);
    expect(veryLarge.incomeEntries[0]?.amount).toBe("30000.00");
  });

  it("stops expected rent at the agreement end month, including a mid-month end date", () => {
    const ending = { ...reduta, leaseEndDate: "2026-10-31" };
    expect(rentMonthAmounts(ending, [], "2026-09", now).expectedGrosz).toBe(320_000);
    expect(rentMonthAmounts(ending, [], "2026-10", now).expectedGrosz).toBe(320_000);
    expect(rentMonthAmounts(ending, [], "2026-11", now).expectedGrosz).toBeNull();
    expect(rentMonthAmounts({ ...ending, leaseEndDate: "2026-10-12" }, [], "2026-10", now).expectedGrosz).toBe(320_000);
  });

  it("does not allocate a post-agreement receipt into a future rent month", () => {
    const ending = { ...reduta, leaseEndDate: "2026-10-31", rentSchedule: [{ effectiveFrom: "2026-09", amount: "2700.00" }] };
    const result = allocateRentReceipts(ending, [receipt("post-end", "9000.00", "2026-11-12", reduta.id, "2026-11")], now);
    expect(result.byMonth.has("2026-11")).toBe(false);
    expect(result.unallocatedGrosz).toBe(260_000);
  });

  it("keeps exact and partial rent receipts free of unallocated excess", () => {
    expect(rentMonthAmounts(reduta, [receipt("exact", "3200.00")], "2026-09", now).unallocatedGrosz).toBe(0);
    expect(rentMonthAmounts(reduta, [receipt("partial", "1000.00")], "2026-09", now).unallocatedGrosz).toBe(0);
    expect(rentMonthAmounts(reduta, [receipt("over", "3500.00")], "2026-09", now).unallocatedGrosz).toBe(30_000);
  });

  it("prioritizes an explicit rent month, then closes the oldest unpaid historical month", () => {
    const historical = { ...reduta, rentSchedule: [{ effectiveFrom: "2026-08", amount: "3900.00" }] };
    const entries = [receipt("aug", "3000.00", "2026-08-27", reduta.id, "2026-08"), receipt("sep", "4800.00", "2026-09-27", reduta.id, "2026-09")];
    expect(rentMonthAmounts(historical, entries, "2026-09", now)).toMatchObject({ expectedGrosz: 440_000, confirmedGrosz: 440_000, remainingGrosz: 0 });
    expect(rentMonthAmounts(historical, entries, "2026-08", now)).toMatchObject({ confirmedGrosz: 340_000, remainingGrosz: 100_000 });
    expect(rentMonthAmounts(historical, entries, "2026-10", now)).toMatchObject({ confirmedGrosz: 0, remainingGrosz: 440_000 });
  });

  it("keeps an explicit September overpayment unallocated and leaves October at its expected rent", () => {
    const expected2600: Property = { ...reduta, ownerRent: "2600.00", rentSchedule: [{ effectiveFrom: "2026-09", amount: "2600.00" }] };
    const entry = receipt("sep-overpayment", "10000.00", "2026-09-27", expected2600.id, "2026-09");
    const taxBeforeAllocation = calculateSettlements({ entries: [entry], payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-27" });
    const allocation = allocateRentReceipts(expected2600, [entry], now);

    expect(allocation.byMonth.get("2026-09")).toBe(310_000);
    expect(allocation.unallocatedGrosz).toBe(690_000);
    expect(rentMonthAmounts(expected2600, [entry], "2026-10", now)).toMatchObject({ expectedGrosz: 310_000, confirmedGrosz: 0, remainingGrosz: 310_000 });
    const taxAfterAllocation = calculateSettlements({ entries: [entry], payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-27" });
    expect(taxAfterAllocation).toEqual(taxBeforeAllocation);
    const tax = taxAfterAllocation[8]!;
    expect(tax).toMatchObject({ revenueGrosz: 1_000_000, obligationGrosz: 85_000 });
  });

  it("allocates receipts without rentalMonth to the oldest open month due by receipt date", () => {
    const historical = { ...reduta, rentSchedule: [{ effectiveFrom: "2026-08", amount: "3900.00" }] };
    const entries = [receipt("aug", "3000.00", "2026-08-27", reduta.id, "2026-08"), receipt("unspecified", "4800.00", "2026-09-27", reduta.id)];
    expect(rentMonthAmounts(historical, entries, "2026-08", now)).toMatchObject({ confirmedGrosz: 440_000, remainingGrosz: 0 });
    expect(rentMonthAmounts(historical, entries, "2026-09", now)).toMatchObject({ confirmedGrosz: 340_000, remainingGrosz: 100_000 });
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
    doc.settings.reminderCategories.rent = false;
    const tasks = deriveTasks(doc, now);
    expect(tasks.some((task) => task.id === "TENANT_PAYMENT_CHECK:reduta:2026-09")).toBe(true);
    expect(taskNotificationPlan(doc, now).map((item) => item.key)).not.toContain("TENANT_PAYMENT_CHECK:reduta:2026-09");
  });
});
