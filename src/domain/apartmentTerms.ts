import type { IncomeEntry, Property, RentRate } from "../model/rental";
import { moneyToGrosz } from "./ryczaltTax";

export type EffectiveApartmentTerms = {
  ownerRentGrosz: number;
  mediaAmountGrosz: number;
  mediaPaidByTenant: boolean;
  taxableTreatment?: RentRate["taxableTreatment"];
  paymentDay?: number;
  hasCompleteSnapshot: boolean;
};

export type ApartmentTermsInput = Pick<RentRate, "amount" | "mediaAmount" | "mediaPaidByTenant" | "taxableTreatment" | "paymentDay">;

export function hasConfirmedRentForMonth(propertyId: string, entries: IncomeEntry[], month: string): boolean {
  return entries.some((entry) => entry.propertyId === propertyId && (entry.rentalMonth ?? entry.receivedAt.slice(0, 7)) === month);
}

export function apartmentTermsChangedForMonth(property: Property, month: string, next: ApartmentTermsInput): boolean {
  const current = apartmentTermsForMonth(property, month);
  return moneyToGrosz(next.amount) !== (current?.ownerRentGrosz ?? moneyToGrosz(property.ownerRent ?? "0"))
    || moneyToGrosz(next.mediaAmount ?? "0") !== (current?.mediaAmountGrosz ?? moneyToGrosz(property.mediaAmount ?? "0"))
    || (next.mediaPaidByTenant ?? false) !== (current?.mediaPaidByTenant ?? property.mediaPaidByTenant ?? false)
    || next.taxableTreatment !== (current?.taxableTreatment ?? property.taxableTreatment)
    || (next.paymentDay ?? 5) !== (current?.paymentDay ?? property.paymentDay ?? 5);
}

export function termsChangeMustStartNextMonth(
  property: Property,
  entries: IncomeEntry[],
  month: string,
  effectiveFrom: string,
  next: ApartmentTermsInput,
  mediaConfirmed = false,
): boolean {
  return effectiveFrom <= month
    && (hasConfirmedRentForMonth(property.id, entries, month) || mediaConfirmed)
    && apartmentTermsChangedForMonth(property, month, next);
}

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
