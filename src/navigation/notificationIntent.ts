import { isRentalMonth } from "../domain/rentalValidation";

export type NotificationIntent =
  | { screen: "Pulpit"; params: { screen: "Wpłaty"; params: { quickAdd: true; returnTo: "Przegląd"; propertyId: string; rentalMonth: string; expectedAmount?: string } } }
  | { screen: "Podatek"; params: { period: string } }
  | { screen: "Ustawienia"; params: { propertyId?: string; billId?: string; period?: string } }
  | { screen: "Pulpit"; params: { screen: "Przegląd"; params: { taskId?: string; billId?: string; period?: string } } };

const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const rentalMonth = (value: unknown): value is string => nonEmptyString(value) && isRentalMonth(value);
const taxPeriod = rentalMonth;

export function notificationDataToIntent(data: Record<string, unknown>): NotificationIntent | null {
  if (data.category === "rent" && nonEmptyString(data.propertyId) && rentalMonth(data.period)) {
    const expectedAmount = typeof data.expectedAmount === "string" && /^\d+(\.\d{1,2})?$/.test(data.expectedAmount) ? data.expectedAmount : undefined;
    return { screen: "Pulpit", params: { screen: "Wpłaty", params: {
      quickAdd: true, returnTo: "Przegląd", propertyId: data.propertyId, rentalMonth: data.period,
      ...(expectedAmount ? { expectedAmount } : {}),
    } } };
  }
  if (data.category === "tax" && taxPeriod(data.period))
    return { screen: "Podatek", params: { period: data.period } };
  if (data.category === "bill" && nonEmptyString(data.billId)) {
    if (data.period === undefined) return { screen: "Ustawienia", params: { billId: data.billId } };
    if (!rentalMonth(data.period)) return null;
    return { screen: "Ustawienia", params: { billId: data.billId, period: data.period } };
  }
  if (data.category === "agreement" && nonEmptyString(data.propertyId))
    return { screen: "Ustawienia", params: { propertyId: data.propertyId } };
  return null;
}
