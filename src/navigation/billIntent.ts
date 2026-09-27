export function recurringBillTaskIntent(billId: string, period: string) {
  return { screen: "Ustawienia" as const, params: { billId, period } };
}
