import { describe, expect, it } from "vitest";
import type { AssistantTask } from "./tasks";
import { isValidTaxMicroAccount } from "./rentalValidation";
import { SETTINGS_TAX_LEGAL_DEFAULT_OPEN, SETTINGS_TAX_RECIPIENT, settingsArchiveLabel, settingsBackupStatus, settingsNotificationSwitchValue, settingsNotificationsUnavailable, settingsReminderHasMore, settingsReminderList } from "./settingsPresentation";

const task = (id: string, day: number): AssistantTask => ({
  id, type: "RENTAL_AGREEMENT_END", title: id, detail: "", dueAt: new Date(2026, 8, day), notificationAt: new Date(2026, 8, day),
  status: "upcoming", dismissible: true, manuallyCompletable: true,
});

describe("settings presentation", () => {
  it("hides an empty archive and labels it with the archived count when present", () => {
    expect(settingsArchiveLabel(0)).toBeNull();
    expect(settingsArchiveLabel(2)).toBe("Archiwum · 2");
  });

  it("shows only the three nearest reminders by default and exposes all on request", () => {
    const tasks = [task("late", 20), task("first", 2), task("third", 8), task("second", 4)];
    expect(settingsReminderList(tasks).map(({ id }) => id)).toEqual(["first", "second", "third"]);
    expect(settingsReminderHasMore(tasks)).toBe(true);
    expect(settingsReminderList(tasks, true)).toHaveLength(4);
    expect(settingsReminderHasMore(tasks, true)).toBe(false);
  });

  it("marks browser notifications unavailable", () => {
    expect(settingsNotificationsUnavailable("unavailable")).toBe(true);
    expect(settingsNotificationsUnavailable("granted")).toBe(false);
    expect(settingsNotificationSwitchValue(true, "unavailable")).toBe(false);
    expect(settingsNotificationSwitchValue(true, "granted")).toBe(true);
  });

  it("requires a numeric, checksum-valid 26-digit micro-account and uses a static recipient", () => {
    expect(isValidTaxMicroAccount("61109010140000071219812874")).toBe(true);
    expect(isValidTaxMicroAccount("PL61109010140000071219812874")).toBe(false);
    expect(isValidTaxMicroAccount("00000000000000000000000000")).toBe(false);
    expect(SETTINGS_TAX_RECIPIENT).toBe("Urząd skarbowy");
  });

  it("keeps tax guidance collapsed and states current local backup capabilities", () => {
    expect(SETTINGS_TAX_LEGAL_DEFAULT_OPEN).toBe(false);
    expect(settingsBackupStatus.local).toContain("zapisane na tym urządzeniu");
    expect(settingsBackupStatus.capabilities).toContain("plik JSON");
    expect(settingsBackupStatus.uninstall).toContain("może usunąć");
    expect(settingsBackupStatus.network).toContain("nie synchronizuje");
  });
});
