export function supportsLocalNotifications(platform: string): boolean {
  return platform !== "web";
}
