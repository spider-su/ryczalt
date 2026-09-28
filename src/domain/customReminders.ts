import type { CustomReminder, ReminderRecurrence, RentalDocument } from "../model/rental";
import { formatPolishDate } from "./presentationFormat";

export function reminderOccurrenceDates(reminder: CustomReminder, now = new Date()): string[] {
  if (reminder.recurrence === "ONCE") return [reminder.dueDate];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const anchor = parseDate(reminder.dueDate);
  const current = parseDate(today);
  const currentIndex = reminder.recurrence === "MONTHLY"
    ? (current.year - anchor.year) * 12 + current.month - anchor.month
    : current.year - anchor.year;
  // Keep this calendar period's occurrence (including an overdue one) plus one
  // future occurrence. This bounds the list and makes annual leap-day behavior
  // predictable without carrying stale prior-year tasks forever.
  const activeIndex = Math.max(0, currentIndex);
  return [occurrence(reminder, activeIndex), occurrence(reminder, activeIndex + 1)];
}

export function customReminderTaskId(reminder: Pick<CustomReminder, "id" | "recurrence">, dueDate: string): string {
  return reminder.recurrence === "ONCE" ? `CUSTOM_REMINDER:${reminder.id}` : `CUSTOM_REMINDER:${reminder.id}:${dueDate}`;
}

export function findCustomReminderForTask(reminders: CustomReminder[], taskId: string): CustomReminder | undefined {
  return reminders.find((reminder) => customReminderTaskStateBelongsTo(taskId, reminder.id));
}

export function customReminderTaskStateBelongsTo(taskId: string, reminderId: string): boolean {
  const prefix = `CUSTOM_REMINDER:${reminderId}`;
  if (taskId === prefix) return true;
  return taskId.startsWith(`${prefix}:`) && /^\d{4}-\d{2}-\d{2}$/.test(taskId.slice(prefix.length + 1));
}

export function saveCustomReminder(document: RentalDocument, reminder: CustomReminder, occurrenceTaskId?: string): RentalDocument {
  const existing = document.customReminders.find((item) => item.id === reminder.id);
  const scheduleChanged = Boolean(existing && (existing.recurrence !== reminder.recurrence || existing.dueDate !== reminder.dueDate));
  return {
    ...document,
    customReminders: existing
      ? document.customReminders.map((item) => item.id === reminder.id ? reminder : item)
      : [...document.customReminders, reminder],
    taskStates: existing
      ? document.taskStates.filter((state) => scheduleChanged
        ? !customReminderTaskStateBelongsTo(state.taskId, reminder.id)
        : state.taskId !== occurrenceTaskId)
      : document.taskStates,
  };
}

export function deleteCustomReminder(document: RentalDocument, reminderId: string): RentalDocument {
  return {
    ...document,
    customReminders: document.customReminders.filter((reminder) => reminder.id !== reminderId),
    taskStates: document.taskStates.filter((state) => !customReminderTaskStateBelongsTo(state.taskId, reminderId)),
  };
}

export function recurrenceLabel(recurrence: ReminderRecurrence, dueDate: string): string {
  if (recurrence === "ONCE") return "Jednorazowo";
  const { year, month, day } = parseDate(dueDate);
  if (recurrence === "MONTHLY") return `Co miesiąc · ${day}. dzień miesiąca`;
  const date = new Date(year, month - 1, day);
  const dateLabel = formatPolishDate(date, "long");
  return `Co rok · ${dateLabel}`;
}

function occurrence(reminder: CustomReminder, index: number): string {
  const { year, month, day } = parseDate(reminder.dueDate);
  if (reminder.recurrence === "MONTHLY") {
    const targetMonth = month - 1 + index;
    const targetYear = year + Math.floor(targetMonth / 12);
    const monthOfYear = targetMonth % 12;
    return makeDate(targetYear, monthOfYear + 1, Math.min(day, daysInMonth(targetYear, monthOfYear + 1)));
  }
  const targetYear = year + index;
  return makeDate(targetYear, month, Math.min(day, daysInMonth(targetYear, month)));
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
