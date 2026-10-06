import { describe, expect, it, vi } from "vitest";
import type { RentalDocument } from "../model/rental";
import { reconcileReminderSchedule } from "../notifications/reconcile";
import { missingPaymentDetails } from "./paymentDetails";
import { isValidPolishBankAccount } from "./rentalValidation";
import { supportsLocalNotifications } from "../notifications/support";
import { ensureAndroidReminderChannel } from "../notifications/androidChannel";
import { summarizeRentMonth } from "./reminders";
import { deriveTasks, taskNotificationPlan } from "./tasks";

const fixture = (): RentalDocument => ({
  schemaVersion: 1,
  properties: [{ id: "p1", address: "Parkowa", ownerRent: "3000.00", paymentDay: 30,
    rentSchedule: [{ effectiveFrom: "2026-01", amount: "3000.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 30 }], leaseEndDate: "2026-12-31" }],
  incomeEntries: [{ id: "i1", propertyId: "p1", receivedAt: "2026-01-10", rentalMonth: "2026-01", amount: "1000.00", taxableAmount: "300.00" }],
  taxPayments: [], recurringBills: [{ id: "b1", propertyId: "p1", name: "Prąd", reminderEnabled: true, dueDay: 15, variableAmount: true }],
  billPayments: [], administrationSuggestions: [], customReminders: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 0 },
});

describe("task reminders and payment details", () => {
  it("groups properties due on the same day and keeps different due days separate", () => {
    const doc = fixture();
    doc.properties.push({ id: "p2", address: "Mogilska 12 / 8", ownerRent: "1800.00", paymentDay: 30, rentSchedule: [{ effectiveFrom: "2026-01", amount: "1800.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 30 }] });
    const now = new Date(2026, 8, 1, 8);
    const september = taskNotificationPlan(doc, now).filter((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:2026-09:"));
    expect(september).toHaveLength(1);
    expect(september[0]?.body).toContain("Parkowa, Mogilska 12 / 8");
    doc.properties[1]!.paymentDay = 25;
    doc.properties[1]!.rentSchedule![0]!.paymentDay = 25;
    const split = taskNotificationPlan(doc, now).filter((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:2026-09:"));
    expect(split).toHaveLength(2);
  });

  it("uses expected rent only for known rate months and compares actual receipts", () => {
    const doc = fixture();
    expect(summarizeRentMonth(doc.properties[0]!, doc.incomeEntries, "2026-01", new Date(2026, 0, 1))).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 100_000, remainingGrosz: 200_000, status: "check" });
    expect(summarizeRentMonth(doc.properties[0]!, doc.incomeEntries, "2025-12", new Date(2026, 0, 1)).status).toBe("unknown");
  });

  it("uses clamped local dates and maintains one stable reminder per task", async () => {
    const doc = fixture();
    const now = new Date(2026, 0, 1, 8);
    doc.properties[0]!.paymentDay = 31;
    doc.properties[0]!.rentSchedule![0]!.paymentDay = 31;
    const plan = taskNotificationPlan(doc, now);
    const rent = plan.find((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:"));
    expect(rent?.fireAt).toEqual(new Date(2026, 0, 31, 9));
    const agreement = taskNotificationPlan(doc, new Date(2026, 9, 1, 8)).find((item) => item.key === "RENTAL_AGREEMENT_END:p1:2026-12-31:30");
    expect(agreement?.fireAt).toEqual(new Date(2026, 11, 1, 9));
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(plan, [], cancel, schedule);
    await reconcileReminderSchedule(plan, plan.map((item, index) => ({ identifier: `${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature })), cancel, schedule);
    expect(schedule).toHaveBeenCalledTimes(plan.length);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("retries a transient scheduling failure without changing support or permission state", async () => {
    const plan = taskNotificationPlan(fixture(), new Date(2026, 0, 1, 8));
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn().mockRejectedValueOnce(new Error("temporary OS scheduling failure")).mockResolvedValue(undefined);
    await expect(reconcileReminderSchedule(plan, [], cancel, schedule)).rejects.toThrow("temporary OS scheduling failure");
    expect(supportsLocalNotifications("android")).toBe(true);
    expect(await reconcileReminderSchedule(plan, [], cancel, schedule)).toBeUndefined();
    expect(schedule).toHaveBeenCalledTimes(plan.length + 1);
  });

  it("ensures the Android channel independently and tolerates repeated initialization", async () => {
    const createChannel = vi.fn(async () => null);
    await ensureAndroidReminderChannel("android", createChannel);
    await ensureAndroidReminderChannel("android", createChannel);
    await ensureAndroidReminderChannel("ios", createChannel);
    expect(createChannel).toHaveBeenCalledTimes(2);
    expect(createChannel).toHaveBeenLastCalledWith("reminders", { name: "Przypomnienia", importance: 5 });
  });

  it("cancels notifications that become obsolete after a date change", async () => {
    const doc = fixture();
    const now = new Date(2026, 8, 26, 8);
    const oldPlan = taskNotificationPlan(doc, now);
    doc.properties[0]!.leaseEndDate = "2027-01-31";
    const newPlan = taskNotificationPlan(doc, now);
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(newPlan, oldPlan.map((item) => ({ identifier: item.key, reminderKey: `ryczalt:${item.key}`, signature: item.signature })), cancel, schedule);
    expect(cancel).toHaveBeenCalled();
  });

  it("cancels duplicate scheduled identifiers and preserves one matching reminder", async () => {
    const doc = fixture();
    const plan = taskNotificationPlan(doc, new Date(2026, 8, 26, 8));
    const rent = plan.find((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:"))!;
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(plan, [
      { identifier: "rent-first", reminderKey: `ryczalt:${rent.key}`, signature: rent.signature },
      { identifier: "rent-duplicate", reminderKey: `ryczalt:${rent.key}`, signature: rent.signature },
    ], cancel, schedule);
    expect(cancel).toHaveBeenCalledWith("rent-duplicate");
    expect(schedule).not.toHaveBeenCalledWith(rent);
  });

  it("uses generic lock-screen text and keeps each category switch independent", async () => {
    const doc = fixture();
    doc.properties[0]!.leaseEndDate = "2026-09-15";
    doc.customReminders = [{ id: "r1", title: "Sprawdź licznik", dueDate: "2026-08-05", propertyId: "p1", note: "Szczegóły poufne", recurrence: "ONCE" }];
    doc.incomeEntries = [{ id: "taxable", propertyId: "p1", receivedAt: "2026-07-10", rentalMonth: "2026-07", amount: "3000.00", taxableAmount: "3000.00" }];
    const now = new Date(2026, 7, 1, 8);
    const plan = taskNotificationPlan(doc, now);
    expect(plan.map((item) => item.key)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^TENANT_PAYMENT_CHECK:/), expect.stringMatching(/^RENTAL_AGREEMENT_END:/),
      expect.stringMatching(/^TAX_PAYMENT:/),
    ]));
    for (const reminder of plan) {
      expect(`${reminder.title} ${reminder.body}`).not.toMatch(/Prąd|Sprawdź licznik|3000|1000|poufne/);
    }

    const keyCategory: Record<string, keyof RentalDocument["settings"]["reminderCategories"]> = {
      "TENANT_PAYMENT_CHECK:group:": "rent",
      "RENTAL_AGREEMENT_END:": "agreements",
      "TAX_PAYMENT:": "tax",
    };
    for (const [prefix, category] of Object.entries(keyCategory)) {
      const switchedOff = structuredClone(doc);
      switchedOff.settings.reminderCategories[category] = false;
      const after = taskNotificationPlan(switchedOff, now);
      expect(after.some((item) => item.key.startsWith(prefix))).toBe(false);
      expect(taskNotificationPlan(doc, now).some((item) => item.key.startsWith(prefix))).toBe(true);
      const taskPrefix = prefix === "TENANT_PAYMENT_CHECK:group:" ? "TENANT_PAYMENT_CHECK:" : prefix;
      expect(deriveTasks(switchedOff, now).some((task) => task.id.startsWith(taskPrefix))).toBe(true);
    }

    const sourceSwitchesOff = structuredClone(doc);
    sourceSwitchesOff.settings.reminderCategories.rent = false;
    expect(taskNotificationPlan(sourceSwitchesOff, now).some((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:"))).toBe(false);
    expect(deriveTasks(sourceSwitchesOff, now).some((task) => task.id.startsWith("TENANT_PAYMENT_CHECK:"))).toBe(true);
    sourceSwitchesOff.settings.reminderCategories.rent = true;
    expect(taskNotificationPlan(sourceSwitchesOff, now).some((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:"))).toBe(true);

    const active = taskNotificationPlan(doc, now);
    const rentKey = active.find((item) => item.key.startsWith("TENANT_PAYMENT_CHECK:group:"))!.key;
    const rent = active.find((item) => item.key === rentKey)!;
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(active.filter((item) => item.key !== rentKey), [
      { identifier: "rent-id", reminderKey: `ryczalt:${rentKey}`, signature: rent.signature },
    ], cancel, schedule);
    expect(cancel).toHaveBeenCalledWith("rent-id");
    cancel.mockClear();
    schedule.mockClear();
    await reconcileReminderSchedule(active, [], cancel, schedule);
    await reconcileReminderSchedule(active, active.map((item, index) => ({
      identifier: `scheduled-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature,
    })), cancel, schedule);
    expect(schedule).toHaveBeenCalledTimes(active.length);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("keeps web usable without OS reminders and validates copied payment details", () => {
    expect(supportsLocalNotifications("web")).toBe(false);
    expect(supportsLocalNotifications("android")).toBe(true);
    expect(isValidPolishBankAccount("PL61109010140000071219812874")).toBe(true);
    expect(isValidPolishBankAccount("00000000000000000000000000")).toBe(false);
    expect(missingPaymentDetails({ bankAccount: "123", amount: "0", title: "" })).toContain("nazwa odbiorcy");
  });
});
