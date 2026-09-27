export type NotificationIntent =
  | { screen: "Przychód"; params: { quickAdd: true; propertyId: string; rentalMonth: string; expectedAmount?: string } }
  | { screen: "Podatek"; params: { period: string } }
  | { screen: "Ustawienia"; params: { propertyId?: string; billId?: string } }
  | { screen: "Pulpit"; params: { taskId: string } };

export function notificationDataToIntent(data: Record<string, unknown>): NotificationIntent | null {
  if (data.category === "rent" && typeof data.propertyId === "string" && typeof data.period === "string") {
    return { screen: "Przychód", params: {
      quickAdd: true, propertyId: data.propertyId, rentalMonth: data.period,
      ...(typeof data.expectedAmount === "string" ? { expectedAmount: data.expectedAmount } : {}),
    } };
  }
  if (data.category === "tax" && typeof data.period === "string")
    return { screen: "Podatek", params: { period: data.period } };
  if (data.category === "bill" && typeof data.billId === "string")
    return { screen: "Ustawienia", params: { billId: data.billId } };
  if (data.category === "agreement" && typeof data.propertyId === "string")
    return { screen: "Ustawienia", params: { propertyId: data.propertyId } };
  if (data.category === "custom" && typeof data.taskId === "string")
    return { screen: "Pulpit", params: { taskId: data.taskId } };
  return null;
}
