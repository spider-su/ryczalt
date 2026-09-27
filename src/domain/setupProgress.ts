import type { Property, RentalDocument } from "../model/rental";

export type SetupAction =
  | "apartment"
  | "rent"
  | "payment-day"
  | "payment-reminder"
  | "tenant"
  | "agreement-end"
  | "administrator-portal";

export type SetupSuggestion = {
  propertyId: string;
  propertyName: string;
  action: Exclude<SetupAction, "apartment" | "rent" | "payment-day">;
  label: string;
};

export type SetupProgress = {
  totalRequiredSteps: number;
  completedRequiredSteps: number;
  optionalSuggestions: SetupSuggestion[];
  nextAction: { propertyId?: string; propertyName?: string; action: SetupAction; label: string } | null;
  showGuidance: boolean;
};

const requiredSteps = (property: Property) => [
  { complete: Boolean(property.name.trim()), action: "apartment" as const, label: "Dodaj nazwę mieszkania" },
  {
    complete: Boolean(property.defaultMonthlyRent?.trim() || property.rentSchedule?.some((rate) => rate.amount.trim())),
    action: "rent" as const,
    label: "Ustaw miesięczny czynsz",
  },
  {
    complete: Number.isInteger(property.expectedPaymentDay) && property.expectedPaymentDay! >= 1 && property.expectedPaymentDay! <= 31,
    action: "payment-day" as const,
    label: "Ustaw dzień płatności",
  },
];

function suggestionsFor(document: RentalDocument, property: Property): SetupSuggestion[] {
  const suggestions: SetupSuggestion[] = [];
  const base = { propertyId: property.id, propertyName: property.name };
  if (document.settings.reminderCategories.rent && !property.paymentReminderEnabled) {
    suggestions.push({ ...base, action: "payment-reminder", label: "Włącz przypomnienie o wpłacie" });
  }
  if (!property.tenantName?.trim()) suggestions.push({ ...base, action: "tenant", label: "Dodaj najemcę" });
  if (!property.rentalEndDate) suggestions.push({ ...base, action: "agreement-end", label: "Dodaj datę końca umowy (opcjonalnie)" });
  const hasPortal = Boolean(property.administratorPortalUrl?.trim()) || document.propertyLinks.some(
    (link) => link.propertyId === property.id && link.category === "ADMINISTRATION",
  );
  if (!hasPortal) suggestions.push({ ...base, action: "administrator-portal", label: "Dodaj portal administracji" });
  return suggestions;
}

/** Derives lightweight property setup guidance from the real local rental document. */
export function deriveSetupProgress(document: RentalDocument): SetupProgress {
  if (document.properties.length === 0) {
    return {
      totalRequiredSteps: 3,
      completedRequiredSteps: 0,
      optionalSuggestions: [],
      nextAction: { action: "apartment", label: "Dodaj mieszkanie" },
      showGuidance: true,
    };
  }

  const evaluated = document.properties.map((property) => ({ property, steps: requiredSteps(property) }));
  const totalRequiredSteps = evaluated.reduce((total, item) => total + item.steps.length, 0);
  const completedRequiredSteps = evaluated.reduce((total, item) => total + item.steps.filter((step) => step.complete).length, 0);
  const incomplete = evaluated.find((item) => item.steps.some((step) => !step.complete));
  const missing = incomplete?.steps.find((step) => !step.complete);
  const optionalSuggestions = document.properties.flatMap((property) => suggestionsFor(document, property));
  const nextAction = incomplete && missing
    ? { propertyId: incomplete.property.id, propertyName: incomplete.property.name, action: missing.action, label: missing.label }
    : optionalSuggestions.find((suggestion) => suggestion.action === "payment-reminder") ?? null;

  return {
    totalRequiredSteps,
    completedRequiredSteps,
    optionalSuggestions,
    nextAction,
    showGuidance: Boolean(incomplete || optionalSuggestions.some((suggestion) => suggestion.action === "payment-reminder")),
  };
}
