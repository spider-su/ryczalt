import * as Notifications from "expo-notifications";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Linking, Platform } from "react-native";
import { buildReminderPlan } from "../domain/reminders";
import { reconcileReminderSchedule } from "./reconcile";
import { useRentalData } from "../data/RentalDataProvider";
import { supportsLocalNotifications } from "./support";

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
  const { document } = useRentalData();
  const [permission, setPermission] = useState<ReminderPermission>(supportsLocalNotifications(Platform.OS) ? "unknown" : "unavailable");
  const queue = useRef(Promise.resolve());

  const requestPermission = useCallback(async () => {
    if (!supportsLocalNotifications(Platform.OS)) {
      setPermission("unavailable");
      return "unavailable";
    }
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Przypomnienia", importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
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
  }, []);

  const reconcile = useCallback(async () => {
    if (!supportsLocalNotifications(Platform.OS) || !document || permission !== "granted") return;
    const plan = buildReminderPlan(document);
    queue.current = queue.current.then(async () => {
      try {
        const existing = await Notifications.getAllScheduledNotificationsAsync();
        const owned = existing.filter((item) => String(item.content.data?.reminderKey ?? "").startsWith("ryczalt:")).map((item) => ({
          identifier: item.identifier,
          reminderKey: String(item.content.data?.reminderKey ?? ""),
          signature: String(item.content.data?.signature ?? ""),
        }));
        await reconcileReminderSchedule(plan, owned,
          (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
          async (reminder) => {
            const key = `ryczalt:${reminder.key}`;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: reminder.title,
              body: reminder.body,
              data: { ...reminder.data, reminderKey: key, signature: reminder.signature },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fireAt, channelId: "reminders" },
          });
          },
        );
      } catch {
        setPermission("unavailable");
      }
    });
    await queue.current;
  }, [document, permission]);

  useEffect(() => {
    if (!supportsLocalNotifications(Platform.OS)) return;
    void Notifications.getPermissionsAsync().then((result) => setPermission(result.granted ? "granted" : result.canAskAgain ? "unknown" : "denied")).catch(() => setPermission("unavailable"));
  }, []);

  useEffect(() => { void reconcile(); }, [reconcile]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcile();
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
