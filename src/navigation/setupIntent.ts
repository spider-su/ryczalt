import type { SetupAction } from "../domain/setupProgress";

export type SetupNavigationIntent = {
  screen: "Ustawienia";
  params: { setupAction: SetupAction; propertyId?: string };
};

export function setupActionField(action: SetupAction): string {
  switch (action) {
    case "apartment": return "address";
    case "rent": return "ownerRent";
    case "payment-day": return "paymentDay";
    case "tenant": return "tenantName";
    case "agreement-end": return "leaseEndDate";
    case "administrator-portal": return "administrationName";
  }
}

export function setupActionIntent(action: SetupAction, propertyId?: string): SetupNavigationIntent {
  return {
    screen: "Ustawienia",
    params: { setupAction: action, ...(action !== "apartment" && propertyId ? { propertyId } : {}) },
  };
}
