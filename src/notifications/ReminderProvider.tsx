import * as Notifications from "expo-notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Linking, Platform } from "react-native";
import { taskNotificationPlan } from "../domain/tasks";
import { createSerializedReconciler, reconcileReminderSchedule } from "./reconcile";
import { useRentalData } from "../data/RentalDataProvider";
import { supportsLocalNotifications } from "./support";
import { ensureAndroidReminderChannel } from "./androidChannel";
import { shouldReconcileNotifications } from "../data/demoRentalDocument";

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
      if (!desired.document || !shouldReconcileNotifications(desired.isDemoMode, true, desired.permission === "granted")) return;
      const plan = taskNotificationPlan(desired.document);
      try {
        if (Platform.OS === "android") await ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync);
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        const owned = existing.filter((item) => String(item.content.data?.reminderKey ?? "").startsWith("ryczalt:")).map((item) => ({
          identifier: item.identifier,
          reminderKey: String(item.content.data?.reminderKey ?? ""),
          signature: String(item.content.data?.signature ?? ""),
        }));
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
      } catch {
        // Scheduling failures are transient; foreground/data/settings changes retry.
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

  useEffect(() => {
    if (!supportsLocalNotifications(Platform.OS)) return;
    void Notifications.getPermissionsAsync().then((result) => setPermission(result.granted ? "granted" : result.canAskAgain ? "unknown" : "denied")).catch(() => setPermission("unavailable"));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync).catch(() => undefined);
  }, []);

  useEffect(() => { void reconcile(); }, [reconcile]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (Platform.OS === "android") void ensureAndroidReminderChannel(Platform.OS, Notifications.setNotificationChannelAsync).catch(() => undefined);
        void reconcile();
      }
    });
    return () => subscription.remove();
  }, [reconcile]);

  const value = useMemo(() => ({ permission, requestPermission }), [permission, requestPermission]);
  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error("useReminders must be used inside ReminderProvider");
  return context;
}
