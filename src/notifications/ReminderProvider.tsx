import * as Notifications from "expo-notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Linking, Platform } from "react-native";
import { taskNotificationPlan } from "../domain/tasks";
import { createSerializedReconciler, NotificationPlanInvariantError, NotificationReconciliationError, normalizeReminderPlan, reconcileReminderSchedule } from "./reconcile";
import { useRentalData } from "../data/RentalDataProvider";
import { supportsLocalNotifications } from "./support";
import { ensureAndroidReminderChannel } from "./androidChannel";

export type ReminderPermission = "unknown" | "granted" | "denied" | "unavailable";
type ReminderContextValue = { permission: ReminderPermission; requestPermission: () => Promise<ReminderPermission> };
const ReminderContext = createContext<ReminderContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function ReminderProvider({ children }: PropsWithChildren) {
  const { document, isDemoMode } = useRentalData();
  const [permission, setPermission] = useState<ReminderPermission>(supportsLocalNotifications(Platform.OS) ? "unknown" : "unavailable");
  // A queued run must read the latest render's document when it starts. Capturing
  // the plan before enqueueing lets a stale run re-add notifications after edits.
  const desiredRef = useRef({ document, isDemoMode, permission });
  desiredRef.current = { document, isDemoMode, permission };
  const serializedReconcile = useRef<(() => Promise<void>) | null>(null);
  if (!serializedReconcile.current) {
    serializedReconcile.current = createSerializedReconciler(() => desiredRef.current, async (desired) => {
      if (!desired.document || desired.isDemoMode || desired.permission === "unknown" || desired.permission === "unavailable") return;
      let desiredCount = 0;
      let pendingCount = 0;
      try {
        const candidatePlan = desired.permission === "granted" ? taskNotificationPlan(desired.document) : [];
        desiredCount = candidatePlan.length;
        const plan = normalizeReminderPlan(candidatePlan);
        desiredCount = plan.length;
        if (Platform.OS === "android") await ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync);
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        const owned = existing.filter((item) => String(item.content.data?.reminderKey ?? "").startsWith("ryczalt:")).map((item) => ({
          identifier: item.identifier,
          reminderKey: String(item.content.data?.reminderKey ?? ""),
          signature: String(item.content.data?.signature ?? ""),
        }));
        pendingCount = owned.length;
        await reconcileReminderSchedule(plan, owned,
          (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
          async (reminder) => {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: reminder.title,
                body: reminder.body,
                data: { ...reminder.data, reminderKey: `ryczalt:${reminder.key}`, signature: reminder.signature },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt, channelId: "reminders" },
            });
          },
        );
      } catch (error) {
        const failure = error instanceof NotificationPlanInvariantError
          ? "INVALID_PLAN"
          : error instanceof NotificationReconciliationError
            ? `OS_${error.phase.toUpperCase()}`
            : "OS_QUERY_OR_CHANNEL";
        console.warn("[Ryczałt notifications] reconciliation failed; retry on next app resume or committed data change.", {
          failure,
          desiredCount,
          pendingCount,
          ...(error instanceof NotificationPlanInvariantError
            ? { invalidKeyCount: error.invalidKeyCount, conflictingDuplicateCount: error.conflictingDuplicateCount }
            : {}),
        });
      }
    });
  }

  const requestPermission = useCallback(async () => {
    if (isDemoMode) return permission;
    if (!supportsLocalNotifications(Platform.OS)) {
      setPermission("unavailable");
      return "unavailable";
    }
    try {
      try { await ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync); } catch { /* Permission is independent of channel setup. */ }
      const existing = await Notifications.getPermissionsAsync();
      if (!existing.granted && !existing.canAskAgain) {
        setPermission("denied");
        await Linking.openSettings();
        return "denied";
      }
      const result = existing.granted ? existing : await Notifications.requestPermissionsAsync();
      const next: ReminderPermission = result.granted ? "granted" : "denied";
      setPermission(next);
      return next;
    } catch {
      setPermission("unavailable");
      return "unavailable";
    }
  }, [isDemoMode, permission]);

  const reconcile = useCallback(async () => {
    if (!supportsLocalNotifications(Platform.OS)) return;
    await serializedReconcile.current?.();
  }, []);

  const refreshPermission = useCallback(async () => {
    if (!supportsLocalNotifications(Platform.OS)) {
      setPermission("unavailable");
      return;
    }
    try {
      const result = await Notifications.getPermissionsAsync();
      setPermission(result.granted ? "granted" : result.canAskAgain ? "unknown" : "denied");
    } catch {
      setPermission("unavailable");
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync).catch(() => undefined);
  }, []);

  useEffect(() => { void reconcile(); }, [document, isDemoMode, permission, reconcile]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (Platform.OS === "android") void ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync).catch(() => undefined);
        void refreshPermission();
        void reconcile();
      }
    });
    return () => subscription.remove();
  }, [reconcile, refreshPermission]);

  const value = useMemo(() => ({ permission, requestPermission }), [permission, requestPermission]);
  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error("useReminders must be used inside ReminderProvider");
  return context;
}
