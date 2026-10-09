import type { ReturnTypeTaskNotification } from "../domain/tasks";

export type ScheduledReminder = { identifier: string; reminderKey: string; signature: string };

export class NotificationPlanInvariantError extends Error {
  readonly code = "INVALID_NOTIFICATION_PLAN";

  constructor(
    readonly invalidKeyCount: number,
    readonly conflictingDuplicateCount: number,
  ) {
    super("Notification plan contains invalid or conflicting logical reminder identities.");
    this.name = "NotificationPlanInvariantError";
  }
}

export class NotificationReconciliationError extends Error {
  constructor(readonly phase: "cancel" | "schedule") {
    super(`Notification ${phase} operation failed.`);
    this.name = "NotificationReconciliationError";
  }
}

/** Serialize OS mutations and read desired state only when each run begins. */
export function createSerializedReconciler<T>(getLatest: () => T, reconcile: (desired: T) => Promise<void>) {
  let queue = Promise.resolve();
  return () => {
    const run = () => reconcile(getLatest());
    queue = queue.then(run, run);
    return queue;
  };
}

export async function reconcileReminderSchedule(
  plan: ReturnTypeTaskNotification[],
  scheduled: ScheduledReminder[],
  cancel: (identifier: string) => Promise<void>,
  schedule: (reminder: ReturnTypeTaskNotification) => Promise<void>,
): Promise<void> {
  const desired = normalizeReminderPlan(plan);
  const desiredByKey = new Map(desired.map((item) => [`ryczalt:${item.key}`, item]));
  const current = new Map<string, ScheduledReminder>();
  for (const notification of scheduled) {
    const wanted = desiredByKey.get(notification.reminderKey);
    if (wanted && wanted.signature === notification.signature && !current.has(notification.reminderKey)) {
      current.set(notification.reminderKey, notification);
    } else {
      try {
        await cancel(notification.identifier);
      } catch {
        throw new NotificationReconciliationError("cancel");
      }
    }
  }
  for (const reminder of desired) {
    if (!current.has(`ryczalt:${reminder.key}`)) {
      try {
        await schedule(reminder);
      } catch {
        throw new NotificationReconciliationError("schedule");
      }
    }
  }
}

/** Validates logical identities before any OS mutation and collapses exact duplicates. */
export function normalizeReminderPlan(plan: ReturnTypeTaskNotification[]): ReturnTypeTaskNotification[] {
  const byKey = new Map<string, ReturnTypeTaskNotification>();
  let invalidKeyCount = 0;
  let conflictingDuplicateCount = 0;

  for (const reminder of plan) {
    if (!reminder.key.trim()) {
      invalidKeyCount += 1;
      continue;
    }
    const existing = byKey.get(reminder.key);
    if (!existing) {
      byKey.set(reminder.key, reminder);
      continue;
    }
    if (existing.signature !== reminder.signature || !sameReminderPayload(existing, reminder)) {
      conflictingDuplicateCount += 1;
    }
  }

  if (invalidKeyCount > 0 || conflictingDuplicateCount > 0) {
    throw new NotificationPlanInvariantError(invalidKeyCount, conflictingDuplicateCount);
  }

  return [...byKey.values()].sort((left, right) =>
    left.fireAt.getTime() - right.fireAt.getTime() || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
  );
}

function sameReminderPayload(left: ReturnTypeTaskNotification, right: ReturnTypeTaskNotification): boolean {
  return left.title === right.title
    && left.body === right.body
    && left.fireAt.getTime() === right.fireAt.getTime()
    && JSON.stringify(left.data) === JSON.stringify(right.data);
}
