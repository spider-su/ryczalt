import type { Property } from "../model/rental";
import { isNonnegativeMoney, isPositiveMoney, isValidCalendarDate } from "./rentalValidation";

export type FirstApartmentDraft = {
  address: string;
  tenantName: string;
  rentalStartDate?: string;
  ownerRent: string;
  mediaAmount: string;
  mediaPaidByTenant?: boolean;
  paymentDay: string;
  taxableTreatment?: Property["taxableTreatment"];
};

export type FirstApartmentStep = 0 | 1 | 2;

export function defaultFirstApartmentDraftValues(today: string) {
  return { rentalStartDate: `${today.slice(0, 4)}-01-01`, mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const };
}

const normalizeAmount = (value: string) => value.trim().replace(",", ".");

/** Presentation-only validation. The existing apartment editor remains the authority on saving. */
export function firstApartmentStepError(draft: FirstApartmentDraft, step: FirstApartmentStep): string | null {
  if (step === 0) {
    if (!draft.address.trim()) return "Podaj adres mieszkania.";
    if (!isValidCalendarDate(draft.rentalStartDate ?? "")) return "Podaj prawidłową datę rozpoczęcia najmu.";
    return null;
  }
  if (step === 1) {
    if (!isPositiveMoney(normalizeAmount(draft.ownerRent))) {
      return "Podaj czynsz dla właściciela większy od 0 zł.";
    }
    if (!isNonnegativeMoney(normalizeAmount(draft.mediaAmount) || "0")) {
      return "Kwota mediów musi być nieujemna, maksymalnie dwa miejsca po przecinku.";
    }
    const day = Number(draft.paymentDay.trim());
    if (!draft.paymentDay.trim() || !Number.isInteger(day) || day < 1 || day > 31) {
      return "Dzień płatności musi być liczbą od 1 do 31.";
    }
    return null;
  }
  return draft.taxableTreatment === "OWNER_RENT" || draft.taxableTreatment === "RENT_AND_CHARGES"
    ? null
    : "Wybierz sposób opodatkowania zgodny z umową najmu.";
}

export function canCompleteFirstApartment(draft: FirstApartmentDraft): boolean {
  return [0, 1, 2].every((step) => firstApartmentStepError(draft, step as FirstApartmentStep) === null);
}
