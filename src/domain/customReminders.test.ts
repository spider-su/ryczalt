import { describe, expect, it, vi } from "vitest";
import type { CustomReminder, RentalDocument } from "../model/rental";
import { deleteCustomReminder, customReminderTaskId, findCustomReminderForTask, recurrenceLabel, reminderOccurrenceDates, saveCustomReminder } from "./customReminders";
import { deriveTasks, taskNotificationPlan } from "./tasks";
import { reconcileReminderSchedule } from "../notifications/reconcile";

const document = (reminder: CustomReminder): RentalDocument => ({
  schemaVersion: 6, properties: [], incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [],
  propertyLinks: [], administrationSuggestions: [], customReminders: [reminder], taskStates: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
});

const monthly = (dueDate = "2026-10-15"): CustomReminder => ({ id: "r1", title: "Sprawdź polisę", dueDate, recurrence: "MONTHLY" });

describe("custom reminder recurrence", () => {
  it("keeps one-time reminder identity and completion semantics", () => {
    const reminder: CustomReminder = { id: "once", title: "Sprawdź licznik", dueDate: "2026-10-15", recurrence: "ONCE" };
    const doc = document(reminder);
    expect(reminderOccurrenceDates(reminder, new Date(2026, 9, 1))).toEqual(["2026-10-15"]);
    expect(customReminderTaskId(reminder, reminder.dueDate)).toBe("CUSTOM_REMINDER:once");
    doc.taskStates = [{ taskId: "CUSTOM_REMINDER:once", completedAt: "2026-10-15T08:00:00.000Z" }];
    expect(deriveTasks(doc, new Date(2026, 9, 16)).find((task) => task.id === "CUSTOM_REMINDER:once")?.status).toBe("completed");
  });

  it("projects only the current and nearest upcoming monthly occurrences", () => {
    const reminder = monthly();
    expect(reminderOccurrenceDates(reminder, new Date(2026, 9, 14))).toEqual(["2026-10-15", "2026-11-15"]);
    const doc = document(reminder);
    const tasks = deriveTasks(doc, new Date(2026, 9, 14)).filter((task) => task.type === "CUSTOM_REMINDER");
    expect(tasks.map((task) => task.id)).toEqual(["CUSTOM_REMINDER:r1:2026-10-15", "CUSTOM_REMINDER:r1:2026-11-15"]);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.detail).toContain("Co miesiąc · 15. dzień miesiąca");
  });

  it("clamps monthly month-end dates while keeping the day-31 anchor", () => {
    const reminder = monthly("2026-01-31");
    expect(reminderOccurrenceDates(reminder, new Date(2026, 0, 30))).toEqual(["2026-01-31", "2026-02-28"]);
    expect(reminderOccurrenceDates(reminder, new Date(2026, 1, 28))).toEqual(["2026-02-28", "2026-03-31"]);
    expect(reminderOccurrenceDates(monthly("2028-01-31"), new Date(2028, 0, 30))).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("completes, snoozes or dismisses one monthly occurrence without changing the next", () => {
    const reminder = monthly();
    const doc = document(reminder);
    const octoberId = "CUSTOM_REMINDER:r1:2026-10-15";
    const novemberId = "CUSTOM_REMINDER:r1:2026-11-15";
    const now = new Date(2026, 9, 16, 10);
    doc.taskStates = [{ taskId: octoberId, completedAt: "2026-10-15T08:00:00.000Z" }];
    expect(deriveTasks(doc, now).find((task) => task.id === octoberId)?.status).toBe("completed");
    expect(deriveTasks(doc, now).find((task) => task.id === novemberId)?.status).toBe("upcoming");

    doc.taskStates = [{ taskId: octoberId, snoozedUntil: "2026-10-18T07:00:00.000Z" }];
    expect(deriveTasks(doc, now).find((task) => task.id === octoberId)?.status).toBe("snoozed");
    const plan = taskNotificationPlan(doc, now);
    expect(plan.find((item) => item.key === octoberId)?.fireAt).toEqual(new Date("2026-10-18T07:00:00.000Z"));
    expect(plan.find((item) => item.key === novemberId)?.fireAt).toEqual(new Date(2026, 10, 15, 9));

    doc.taskStates = [{ taskId: octoberId, dismissedAt: "2026-10-15T08:00:00.000Z" }];
    expect(deriveTasks(doc, now).find((task) => task.id === octoberId)?.status).toBe("dismissed");
    expect(deriveTasks(doc, now).find((task) => task.id === novemberId)?.status).toBe("upcoming");
  });

  it("projects yearly reminders and returns leap-day anchors to February 29", () => {
    const yearly: CustomReminder = { id: "yearly", title: "Przegląd", dueDate: "2026-11-30", recurrence: "YEARLY" };
    expect(reminderOccurrenceDates(yearly, new Date(2026, 10, 1))).toEqual(["2026-11-30", "2027-11-30"]);
    expect(recurrenceLabel("YEARLY", "2026-11-30")).toBe("Co rok · 30 listopada 2026");
    const leapDay: CustomReminder = { id: "leap", title: "Urodziny", dueDate: "2028-02-29", recurrence: "YEARLY" };
    expect(reminderOccurrenceDates(leapDay, new Date(2028, 1, 28))).toEqual(["2028-02-29", "2029-02-28"]);
    expect(reminderOccurrenceDates(leapDay, new Date(2029, 1, 27))).toEqual(["2029-02-28", "2030-02-28"]);
    expect(reminderOccurrenceDates(leapDay, new Date(2031, 1, 28))).toEqual(["2031-02-28", "2032-02-29"]);
  });

  it("uses stable, distinct occurrence IDs and finds their source reminder", () => {
    const reminder = monthly();
    expect(customReminderTaskId(reminder, "2026-10-15")).toBe(customReminderTaskId(reminder, "2026-10-15"));
    expect(customReminderTaskId(reminder, "2026-10-15")).not.toBe(customReminderTaskId(reminder, "2026-11-15"));
    expect(findCustomReminderForTask([reminder], "CUSTOM_REMINDER:r1:2026-11-15")).toEqual(reminder);
  });

  it("reprojects changed recurrence or anchor dates and removes obsolete schedules", async () => {
    const doc = document(monthly());
    const now = new Date(2026, 9, 1, 8);
    const oldPlan = taskNotificationPlan(doc, now);
    expect(oldPlan.some((item) => item.key === "CUSTOM_REMINDER:r1:2026-11-15")).toBe(true);
    const yearly = saveCustomReminder(doc, { ...doc.customReminders[0]!, recurrence: "YEARLY" }, "CUSTOM_REMINDER:r1:2026-10-15");
    const yearlyPlan = taskNotificationPlan(yearly, now);
    expect(yearlyPlan.some((item) => item.key === "CUSTOM_REMINDER:r1:2026-11-15")).toBe(false);
    expect(yearlyPlan.some((item) => item.key === "CUSTOM_REMINDER:r1:2027-10-15")).toBe(true);
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(yearlyPlan, oldPlan.map((item, index) => ({
      identifier: `old-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature,
    })), cancel, schedule);
    expect(cancel).toHaveBeenCalledWith("old-1");

    const moved = saveCustomReminder(doc, { ...doc.customReminders[0]!, dueDate: "2026-11-10" });
    const movedPlan = taskNotificationPlan(moved, now);
    expect(movedPlan.some((item) => item.key === "CUSTOM_REMINDER:r1:2026-10-15")).toBe(false);
    expect(movedPlan.some((item) => item.key === "CUSTOM_REMINDER:r1:2026-11-10")).toBe(true);
  });

  it("deletes a reminder and only its occurrence states and notifications", () => {
    const doc = document(monthly());
    doc.taskStates = [
      { taskId: "CUSTOM_REMINDER:r1:2026-10-15", dismissedAt: "2026-10-15T08:00:00.000Z" },
      { taskId: "TAX_PAYMENT:2026-10", completedAt: "2026-10-15T08:00:00.000Z" },
    ];
    const deleted = deleteCustomReminder(doc, "r1");
    expect(deriveTasks(deleted, new Date(2026, 9, 1)).some((task) => task.type === "CUSTOM_REMINDER")).toBe(false);
    expect(taskNotificationPlan(deleted, new Date(2026, 9, 1)).some((item) => item.key.startsWith("CUSTOM_REMINDER:r1"))).toBe(false);
    expect(deleted.taskStates.map((state) => state.taskId)).toEqual(["TAX_PAYMENT:2026-10"]);
  });

  it("reconciles recurring occurrence notifications without duplicates", async () => {
    const plan = taskNotificationPlan(document(monthly()), new Date(2026, 9, 1, 8));
    const cancel = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await reconcileReminderSchedule(plan, [], cancel, schedule);
    expect(schedule).toHaveBeenCalledTimes(2);
    schedule.mockClear();
    const scheduled = plan.map((item, index) => ({ identifier: `notification-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature }));
    await reconcileReminderSchedule(plan, scheduled, cancel, schedule);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();

    const completed = document(monthly());
    completed.taskStates = [{ taskId: "CUSTOM_REMINDER:r1:2026-10-15", completedAt: "2026-10-01T07:00:00.000Z" }];
    const afterCompletion = taskNotificationPlan(completed, new Date(2026, 9, 1, 8));
    expect(afterCompletion.map((item) => item.key)).toEqual(["CUSTOM_REMINDER:r1:2026-11-15"]);
    cancel.mockClear();
    await reconcileReminderSchedule(afterCompletion, plan.map((item, index) => ({
      identifier: `existing-${index}`, reminderKey: `ryczalt:${item.key}`, signature: item.signature,
    })), cancel, schedule);
    expect(cancel).toHaveBeenCalledWith("existing-0");
    expect(schedule).not.toHaveBeenCalled();
  });
});
