import { describe, expect, it, vi } from "vitest";
import type { RentalDocument } from "../model/rental";
import { reconcileReminderSchedule } from "../notifications/reconcile";
import { missingPaymentDetails } from "./paymentDetails";
import { isValidPolishBankAccount } from "./rentalValidation";
import { supportsLocalNotifications } from "../notifications/support";
import { summarizeRentMonth } from "./reminders";
import { taskNotificationPlan } from "./tasks";

const fixture = (): RentalDocument => ({
  schemaVersion: 3,
  properties: [{ id: "p1", name: "Parkowa", defaultMonthlyRent: "3000.00", expectedPaymentDay: 30,
    rentSchedule: [{ effectiveFrom: "2026-01", amount: "3000.00" }], rentalEndDate: "2026-12-31", rentalEndReminderDays: [30, 7] }],
  incomeEntries: [{ id: "i1", propertyId: "p1", receivedAt: "2026-01-10", rentalMonth: "2026-01", amount: "1000.00", taxableAmount: "300.00" }],
  taxPayments: [], recurringBills: [{ id: "b1", propertyId: "p1", name: "Prąd", reminderEnabled: true, dueDay: 15, variableAmount: true }],
  billPayments: [], propertyLinks: [], customReminders: [], taskStates: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
});

describe("task reminders and payment details", () => {
  it("uses expected rent only for known rate months and compares actual receipts", () => {
    const doc = fixture();
    expect(summarizeRentMonth(doc.properties[0]!, doc.incomeEntries, "2026-01", new Date(2026, 0, 1))).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 100_000, remainingGrosz: 200_000, status: "check" });
    expect(summarizeRentMonth(doc.properties[0]!, doc.incomeEntries, "2025-12", new Date(2026, 0, 1)).status).toBe("unknown");
  });

  it("uses clamped local dates and maintains one stable reminder per task", async () => {
    const doc = fixture();
    const now = new Date(2026, 0, 1, 8);
    doc.properties[0]!.expectedPaymentDay = 31;
    const plan = taskNotificationPlan(doc, now);
    const rent = plan.find((item) => item.key === "TENANT_PAYMENT_CHECK:p1:2026-01");
    expect(rent?.fireAt).toEqual(new Date(2026, 1, 1, 9));
    const agreement = plan.find((item) => item.key === "RENTAL_AGREEMENT_END:p1:2026-12-31");
    expect(agreement?.fireAt).toEqual(new Date(2026, 11, 1, 9));
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(plan, [], cancel, schedule);
    await reconcileReminderSchedule(plan, plan.map((item, index) => ({ identifier: `${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature })), cancel, schedule);
    expect(schedule).toHaveBeenCalledTimes(plan.length);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels notifications that become obsolete after a date change", async () => {
    const doc = fixture();
    const now = new Date(2026, 8, 26, 8);
    const oldPlan = taskNotificationPlan(doc, now);
    doc.properties[0]!.rentalEndDate = "2027-01-31";
    const newPlan = taskNotificationPlan(doc, now);
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(newPlan, oldPlan.map((item) => ({ identifier: item.key, reminderKey: `ryczalt:${item.key}`, signature: item.signature })), cancel, schedule);
    expect(cancel).toHaveBeenCalled();
  });

  it("keeps web usable without OS reminders and validates copied payment details", () => {
    expect(supportsLocalNotifications("web")).toBe(false);
    expect(supportsLocalNotifications("android")).toBe(true);
    expect(isValidPolishBankAccount("PL61109010140000071219812874")).toBe(true);
    expect(isValidPolishBankAccount("00000000000000000000000000")).toBe(false);
    expect(missingPaymentDetails({ bankAccount: "123", amount: "0", title: "" })).toContain("nazwa odbiorcy");
  });
});
