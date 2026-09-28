import type { Property, RentalDocument } from "../model/rental";

export type SetupAction =
  | "apartment"
  | "rent"
  | "payment-day"
  | "tenant"
  | "agreement-end"
  | "administrator-portal";

export type SetupProgress = {
  totalRequiredSteps: number;
  completedRequiredSteps: number;
  nextAction: { propertyId?: string; propertyName?: string; action: SetupAction; label: string } | null;
  showGuidance: boolean;
};

const requiredSteps = (property: Property) => [
  { complete: Boolean(property.address.trim()), action: "apartment" as const, label: "Dodaj adres mieszkania" },
  {
    complete: Boolean(property.ownerRent?.trim() || property.rentSchedule?.some((rate) => rate.amount.trim())),
    action: "rent" as const,
    label: "Ustaw czynsz dla właściciela",
  },
  {
    complete: Number.isInteger(property.paymentDay) && property.paymentDay! >= 1 && property.paymentDay! <= 31,
    action: "payment-day" as const,
    label: "Ustaw dzień płatności",
  },
];

/** Derives lightweight property setup guidance from the real local rental document. */
export function deriveSetupProgress(document: RentalDocument): SetupProgress {
  if (document.properties.length === 0) {
    return {
      totalRequiredSteps: 3,
      completedRequiredSteps: 0,
      nextAction: { action: "apartment", label: "Dodaj mieszkanie" },
      showGuidance: true,
    };
  }

  const evaluated = document.properties.map((property) => ({ property, steps: requiredSteps(property) }));
  const totalRequiredSteps = evaluated.reduce((total, item) => total + item.steps.length, 0);
  const completedRequiredSteps = evaluated.reduce((total, item) => total + item.steps.filter((step) => step.complete).length, 0);
  const incomplete = evaluated.find((item) => item.steps.some((step) => !step.complete));
  const missing = incomplete?.steps.find((step) => !step.complete);
  const nextAction = incomplete && missing
    ? { propertyId: incomplete.property.id, propertyName: incomplete.property.address, action: missing.action, label: missing.label }
    : null;

  return {
    totalRequiredSteps,
    completedRequiredSteps,
    nextAction,
    showGuidance: Boolean(incomplete),
  };
}
