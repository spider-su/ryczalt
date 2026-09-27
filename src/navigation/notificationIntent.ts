export type NotificationIntent =
  | { screen: "Przychód"; params: { quickAdd: true; propertyId: string; rentalMonth: string; expectedAmount?: string } }
  | { screen: "Podatek"; params: { period: string } }
  | { screen: "Ustawienia"; params: { propertyId?: string; billId?: string } }
  | { screen: "Pulpit"; params: { taskId: string } };

const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const rentalMonth = (value: unknown): value is string => nonEmptyString(value) && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const taxPeriod = (value: unknown): value is string => nonEmptyString(value) && /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(value);

export function notificationDataToIntent(data: Record<string, unknown>): NotificationIntent | null {
  if (data.category === "rent" && nonEmptyString(data.propertyId) && rentalMonth(data.period)) {
    const expectedAmount = typeof data.expectedAmount === "string" && /^\d+(\.\d{1,2})?$/.test(data.expectedAmount) ? data.expectedAmount : undefined;
    return { screen: "Przychód", params: {
      quickAdd: true, propertyId: data.propertyId, rentalMonth: data.period,
      ...(expectedAmount ? { expectedAmount } : {}),
    } };
  }
  if (data.category === "tax" && taxPeriod(data.period))
    return { screen: "Podatek", params: { period: data.period } };
  if (data.category === "bill" && nonEmptyString(data.billId))
    return { screen: "Ustawienia", params: { billId: data.billId } };
  if (data.category === "agreement" && nonEmptyString(data.propertyId))
    return { screen: "Ustawienia", params: { propertyId: data.propertyId } };
  if (data.category === "custom" && nonEmptyString(data.taskId))
    return { screen: "Pulpit", params: { taskId: data.taskId } };
  return null;
}
