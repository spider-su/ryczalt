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
