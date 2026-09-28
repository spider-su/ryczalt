import type { IncomeEntry, Property } from "../model/rental";
import { ownerRentForMonth } from "./rentAllocation";
import { moneyToGrosz } from "./ryczaltTax";

export function tenantMonthlyTotalGrosz(property: Pick<Property, "ownerRent" | "mediaAmount" | "mediaPaidByTenant">): number {
  const owner = property.ownerRent ? moneyToGrosz(property.ownerRent) : 0;
  const media = property.mediaPaidByTenant ? moneyToGrosz(property.mediaAmount ?? "0") : 0;
  const total = owner + media;
  if (!Number.isSafeInteger(total)) throw new Error("Tenant monthly amount is too large");
  return total;
}

export function decimalFromGrosz(grosz: number): string {
  if (!Number.isSafeInteger(grosz) || grosz < 0) throw new Error("Invalid grosz amount");
  return `${Math.floor(grosz / 100)}.${String(grosz % 100).padStart(2, "0")}`;
}

/** Applies the apartment's explicit contractual tax-base choice across partial receipts in a rental month. */
export function defaultTaxableAmountGrosz(args: {
  property: Property;
  amountGrosz: number;
  rentalMonth: string;
  priorEntries: IncomeEntry[];
  now?: Date;
}): number {
  const { property, amountGrosz, rentalMonth, priorEntries, now = new Date() } = args;
  if (!property.taxableTreatment) throw new Error("Choose the taxable rent treatment before confirming a receipt");
  if (property.taxableTreatment === "RENT_AND_CHARGES") return amountGrosz;
  const ownerRent = ownerRentForMonth(property, rentalMonth, now) ?? (property.ownerRent ? moneyToGrosz(property.ownerRent) : 0);
  const alreadyTaxable = priorEntries.filter((entry) => entry.propertyId === property.id && (entry.rentalMonth ?? entry.receivedAt.slice(0, 7)) === rentalMonth)
    .reduce((total, entry) => total + moneyToGrosz(entry.taxableAmount), 0);
  return Math.min(amountGrosz, Math.max(0, ownerRent - alreadyTaxable));
}
