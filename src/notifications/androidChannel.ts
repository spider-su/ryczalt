import type { NotificationChannelInput } from "expo-notifications";

export const REMINDER_CHANNEL: NotificationChannelInput = {
  name: "Przypomnienia",
  importance: 5,
};

export async function ensureAndroidReminderChannel(
  platform: string,
  createChannel: (channelId: string, channel: NotificationChannelInput) => Promise<unknown>,
): Promise<void> {
  if (platform === "android") await createChannel("reminders", REMINDER_CHANNEL);
}
