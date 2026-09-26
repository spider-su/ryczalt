import { describe, expect, it, vi } from "vitest";
import type { RentalDocument } from "../model/rental";
import { buildReminderPlan, summarizeRentMonth } from "./reminders";
import { reconcileReminderSchedule } from "../notifications/reconcile";
import { isValidPolishBankAccount } from "./rentalValidation";
import { missingPaymentDetails } from "./paymentDetails";
import { supportsLocalNotifications } from "../notifications/support";

const document = (): RentalDocument => ({
  schemaVersion: 2,
  properties: [{
    id: "property-1", name: "Parkowa", defaultMonthlyRent: "3000.00",
    expectedPaymentDay: 10, paymentReminderEnabled: true, paymentReminderDelayDays: 1,
    rentalEndDate: "2026-06-30", rentalEndReminderDays: [30, 7],
  }],
  incomeEntries: [{
    id: "income-1", propertyId: "property-1", receivedAt: "2026-01-10",
    rentalMonth: "2026-01", amount: "1000.00", taxableAmount: "300.00",
  }],
  taxPayments: [], recurringBills: [{
    id: "bill-1", propertyId: "property-1", name: "Prąd", reminderEnabled: true,
    dueDay: 15, variableAmount: true,
  }],
  billPayments: [],
  settings: {
    taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false,
    quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true },
  },
});

describe("local reminder plan and payment details", () => {
  it("compares expected rent with actual received while tax uses only taxable receipts", () => {
    const doc = document();
    expect(summarizeRentMonth(doc.properties[0]!, doc.incomeEntries, "2026-01")).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 100_000, remainingGrosz: 200_000, status: "check" });
    const plan = buildReminderPlan(doc, new Date(2026, 0, 1, 8));
    expect(plan.find((reminder) => reminder.key === "rent:property-1:2026-01")?.fireAt).toEqual(new Date(2026, 0, 11, 9));
    expect(plan.find((reminder) => reminder.key === "tax:2026-01")?.body).toContain("pozostało 26,00 zł");
  });

  it("schedules agreement reminders at local 09:00, and none without an end date", () => {
    const doc = document();
    const agreement = buildReminderPlan(doc, new Date(2026, 0, 1)).find((item) => item.key === "agreement:property-1:30:2026-06-30");
    expect(agreement?.fireAt).toEqual(new Date(2026, 4, 31, 9));
    doc.properties[0]!.rentalEndDate = undefined;
    expect(buildReminderPlan(doc, new Date(2026, 0, 1)).some((item) => item.data.category === "agreement")).toBe(false);
  });

  it("removes apartment reminders when the apartment is deleted", () => {
    const doc = document();
    expect(buildReminderPlan(doc, new Date(2026, 0, 1)).some((item) => item.data.propertyId === "property-1")).toBe(true);
    doc.properties = [];
    doc.recurringBills = [];
    doc.billPayments = [];
    expect(buildReminderPlan(doc, new Date(2026, 0, 1)).some((item) => item.data.propertyId === "property-1")).toBe(false);
  });

  it("falls back cleanly when local notifications are unavailable on web", () => {
    expect(supportsLocalNotifications("web")).toBe(false);
    expect(supportsLocalNotifications("ios")).toBe(true);
    expect(supportsLocalNotifications("android")).toBe(true);
  });

  it("reconciles extensions and preferences without duplicates", async () => {
    const oldPlan = buildReminderPlan(document(), new Date(2026, 0, 1)).filter((item) => item.data.category === "agreement");
    const extended = document();
    extended.properties[0]!.rentalEndDate = "2026-07-30";
    const nextPlan = buildReminderPlan(extended, new Date(2026, 0, 1)).filter((item) => item.data.category === "agreement");
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    const oldScheduled = oldPlan.map((item, index) => ({ identifier: `old-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature }));
    await reconcileReminderSchedule(nextPlan, oldScheduled, cancel, schedule);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenCalledTimes(2);
    await reconcileReminderSchedule(nextPlan, [
      ...nextPlan.map((item, index) => ({ identifier: `new-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature })),
      { identifier: "duplicate", reminderKey: `ryczalt:${nextPlan[0]!.key}`, signature: nextPlan[0]!.signature },
    ], cancel, schedule);
    expect(cancel).toHaveBeenCalledTimes(3);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it("keeps variable bills as verify-first reminders and removes them after a recorded payment", () => {
    const doc = document();
    const first = buildReminderPlan(doc, new Date(2026, 0, 1)).find((item) => item.key === "bill:bill-1:2026-01");
    expect(first?.body).toContain("sprawdź bieżącą kwotę");
    doc.billPayments.push({ id: "bill-payment-1", billId: "bill-1", period: "2026-01", paidAt: "2026-01-12", amount: "143.20" });
    expect(buildReminderPlan(doc, new Date(2026, 0, 1)).some((item) => item.key === "bill:bill-1:2026-01")).toBe(false);
  });

  it("validates account checksum and reports missing payment data rather than inventing it", () => {
    expect(isValidPolishBankAccount("PL61 1090 1014 0000 0712 1981 2874")).toBe(true);
    expect(isValidPolishBankAccount("00000000000000000000000000")).toBe(false);
    expect(missingPaymentDetails({ bankAccount: "123", amount: "0", title: "" })).toEqual([
      "nazwa odbiorcy", "prawidłowy polski numer rachunku", "kwota większa od zera", "tytuł płatności",
    ]);
    expect(missingPaymentDetails({ recipientName: "Odbiorca", bankAccount: "PL61109010140000071219812874", amount: "25.50", title: "Czynsz" })).toEqual([]);
  });
});
