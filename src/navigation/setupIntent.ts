import type { SetupAction } from "../domain/setupProgress";

export type SetupNavigationIntent = {
  screen: "Ustawienia";
  params: { setupAction: SetupAction; propertyId?: string };
};

export function setupActionField(action: SetupAction): string {
  switch (action) {
    case "apartment": return "name";
    case "rent": return "defaultMonthlyRent";
    case "payment-day": return "expectedPaymentDay";
    case "payment-reminder": return "paymentReminderEnabled";
    case "tenant": return "tenantName";
    case "agreement-end": return "rentalEndDate";
    case "administrator-portal": return "administratorPortalUrl";
  }
}

export function setupActionIntent(action: SetupAction, propertyId?: string): SetupNavigationIntent {
  return {
    screen: "Ustawienia",
    params: { setupAction: action, ...(action !== "apartment" && propertyId ? { propertyId } : {}) },
  };
}
