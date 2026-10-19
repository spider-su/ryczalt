import type { AssistantTask } from "./tasks";

export function settingsReminderList(tasks: AssistantTask[], showAll = false, limit = 3) {
  const sorted = tasks.slice().sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
  return showAll ? sorted : sorted.slice(0, limit);
}

export function settingsReminderHasMore(tasks: AssistantTask[], showAll = false, limit = 3) {
  return !showAll && tasks.length > limit;
}

export function settingsArchiveLabel(archivedCount: number) {
  return archivedCount > 0 ? `Archiwum · ${archivedCount}` : null;
}

export function settingsNotificationsUnavailable(permission: string) {
  return permission === "unavailable";
}

export function settingsNotificationSwitchValue(enabled: boolean, permission: string) {
  return !settingsNotificationsUnavailable(permission) && enabled;
}

export const settingsBackupStatus = {
  local: "Dane są zapisane na tym urządzeniu.",
  capabilities: "Możesz wyeksportować plik JSON i przywrócić dane z zapisanej kopii.",
  uninstall: "Odinstalowanie aplikacji może usunąć zapisane tu dane. Zapisz je osobno przed odinstalowaniem.",
  network: "Aplikacja nie synchronizuje danych najmu z serwerem.",
} as const;

export const SETTINGS_TAX_RECIPIENT = "Urząd skarbowy";
export const SETTINGS_TAX_LEGAL_DEFAULT_OPEN = false;

/** Presentation-only grouping. Scheduling and task identities are not changed. */
export function settingsReminderGroups(tasks: AssistantTask[], showAll = false, limit = 3) {
  const sorted = tasks.slice().sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.id.localeCompare(b.id));
  const groups: { key: string; date: Date; type: AssistantTask["type"]; tasks: AssistantTask[] }[] = [];
  for (const task of sorted) {
    const dateKey = [task.dueAt.getFullYear(), String(task.dueAt.getMonth() + 1).padStart(2, "0"), String(task.dueAt.getDate()).padStart(2, "0")].join("-");
    const key = dateKey + ":" + task.type;
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, date: task.dueAt, type: task.type, tasks: [] };
      groups.push(group);
    }
    group.tasks.push(task);
  }
  return showAll ? groups : groups.slice(0, limit);
}

export function settingsReminderGroupsHasMore(tasks: AssistantTask[], showAll = false, limit = 3) {
  return !showAll && settingsReminderGroups(tasks, true).length > limit;
}

export function settingsReminderGroupTitle(type: AssistantTask["type"]) {
  switch (type) {
    case "TENANT_PAYMENT_CHECK": return "Sprawdź czynsz";
    case "RECURRING_BILL": return "Potwierdź opłaty";
    case "TAX_PAYMENT": return "Podatek";
    case "RENTAL_AGREEMENT_END": return "Kończąca się umowa";
  }
}
