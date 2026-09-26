import type { LocalReminder } from "../domain/reminders";

export type ScheduledReminder = { identifier: string; reminderKey: string; signature: string };

export async function reconcileReminderSchedule(
  plan: LocalReminder[],
  scheduled: ScheduledReminder[],
  cancel: (identifier: string) => Promise<void>,
  schedule: (reminder: LocalReminder) => Promise<void>,
): Promise<void> {
  const current = new Map<string, ScheduledReminder>();
  for (const notification of scheduled) {
    const wanted = plan.find((item) => `ryczalt:${item.key}` === notification.reminderKey && item.signature === notification.signature);
    if (wanted && !current.has(notification.reminderKey)) current.set(notification.reminderKey, notification);
    else await cancel(notification.identifier);
  }
  for (const reminder of plan) {
    if (!current.has(`ryczalt:${reminder.key}`)) await schedule(reminder);
  }
}
