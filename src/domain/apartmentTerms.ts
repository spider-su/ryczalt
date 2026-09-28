import type { Property, RentRate } from "../model/rental";
import { moneyToGrosz } from "./ryczaltTax";

export type EffectiveApartmentTerms = {
  ownerRentGrosz: number;
  mediaAmountGrosz: number;
  mediaPaidByTenant: boolean;
  taxableTreatment?: RentRate["taxableTreatment"];
  paymentDay?: number;
  hasCompleteSnapshot: boolean;
};

export function apartmentTermsForMonth(property: Property, month: string): EffectiveApartmentTerms | undefined {
  const applicable = [...(property.rentSchedule ?? [])]
    .filter((rate) => rate.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!applicable) return undefined;
  return {
    ownerRentGrosz: moneyToGrosz(applicable.amount),
    mediaAmountGrosz: moneyToGrosz(applicable.mediaAmount ?? "0"),
    mediaPaidByTenant: applicable.mediaPaidByTenant ?? false,
    ...(applicable.taxableTreatment ? { taxableTreatment: applicable.taxableTreatment } : {}),
    paymentDay: applicable.paymentDay ?? 5,
    hasCompleteSnapshot: applicable.taxableTreatment !== undefined,
  };
}

export function effectivePaymentDay(property: Property, month: string): number {
  return apartmentTermsForMonth(property, month)?.paymentDay ?? 5;
}
