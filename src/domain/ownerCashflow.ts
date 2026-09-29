import type { IncomeEntry, Property } from "../model/rental";
import { apartmentTermsForMonth } from "./apartmentTerms";
import { moneyToGrosz } from "./ryczaltTax";

export type OwnerCashflowSummary = {
  receivedGrosz: number;
  chargesGrosz: number;
  taxGrosz: number;
  ownerNetGrosz: number;
  chargesKnown: boolean;
};

/**
 * Cash view for the landlord: confirmed tenant receipts minus the part of those
 * receipts covering tenant-paid charges and minus tax due.
 *
 * Charges are allocated using the contractual terms for the receipt's rental
 * month. Partial receipts cover owner rent first and charges second, matching
 * the existing OWNER_RENT taxable allocation. Excess above the contractual
 * monthly total is not silently classified as charges.
 */
export function ownerCashflowSummary(args: {
  entries: IncomeEntry[];
  selectedEntries: IncomeEntry[];
  properties: Property[];
  taxGrosz: number;
}): OwnerCashflowSummary {
  const { entries, selectedEntries, properties, taxGrosz } = args;
  const selectedIds = new Set(selectedEntries.map((entry) => entry.id));
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const groups = new Map<string, IncomeEntry[]>();

  entries.forEach((entry) => {
    const rentalMonth = entry.rentalMonth ?? entry.receivedAt.slice(0, 7);
    const key = `${entry.propertyId}:${rentalMonth}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  });

  let chargesGrosz = 0;
  let chargesKnown = true;
  for (const group of groups.values()) {
    const sorted = group.slice().sort((left, right) => left.receivedAt.localeCompare(right.receivedAt) || left.id.localeCompare(right.id));
    const first = sorted[0]!;
    const property = propertyById.get(first.propertyId);
    const rentalMonth = first.rentalMonth ?? first.receivedAt.slice(0, 7);
    const terms = property ? apartmentTermsForMonth(property, rentalMonth) : undefined;
    if (!terms) {
      if (sorted.some((entry) => selectedIds.has(entry.id))) chargesKnown = false;
      continue;
    }
    let ownerRemaining = terms.ownerRentGrosz;
    let chargesRemaining = terms.mediaPaidByTenant ? terms.mediaAmountGrosz : 0;
    for (const entry of sorted) {
      let receipt = moneyToGrosz(entry.amount);
      const ownerPart = Math.min(receipt, ownerRemaining);
      ownerRemaining -= ownerPart;
      receipt -= ownerPart;
      const chargesPart = Math.min(receipt, chargesRemaining);
      chargesRemaining -= chargesPart;
      if (selectedIds.has(entry.id)) chargesGrosz += chargesPart;
    }
  }

  const receivedGrosz = selectedEntries.reduce((total, entry) => total + moneyToGrosz(entry.amount), 0);
  const safeTax = Math.max(0, taxGrosz);
  return {
    receivedGrosz,
    chargesGrosz,
    taxGrosz: safeTax,
    ownerNetGrosz: receivedGrosz - chargesGrosz - safeTax,
    chargesKnown,
  };
}
