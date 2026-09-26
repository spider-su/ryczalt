import type { ReturnTypeTaskNotification } from "../domain/tasks";

export type ScheduledReminder = { identifier: string; reminderKey: string; signature: string };

export async function reconcileReminderSchedule(
  plan: ReturnTypeTaskNotification[],
  scheduled: ScheduledReminder[],
  cancel: (identifier: string) => Promise<void>,
  schedule: (reminder: ReturnTypeTaskNotification) => Promise<void>,
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
