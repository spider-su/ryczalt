import type { IncomeEntry, Property, RentalDocument } from "../model/rental";
import { createIncomeEntry } from "./rentalOperations";
import { ownerRentForMonth } from "./rentAllocation";
import { isRentalMonth } from "./rentalValidation";
import { decimalFromGrosz, defaultTaxableAmountGrosz } from "./apartmentPayments";
import { moneyToGrosz } from "./ryczaltTax";

export type HistoricalBootstrapResult = { document: RentalDocument; created: IncomeEntry[]; skippedMonths: string[] };

export function historicalBootstrapDefaultRange(today: string, rentalStartDate?: string) {
  const year = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const endMonth = currentMonth <= 1 ? null : `${year}-${String(currentMonth - 1).padStart(2, "0")}`;
  const startMonth = rentalStartDate?.slice(0, 7) && rentalStartDate.slice(0, 4) === String(year)
    ? rentalStartDate.slice(0, 7)
    : `${year}-01`;
  return { startMonth, endMonth };
}

export function historicalMonths(startMonth: string, endMonth: string): string[] {
  if (!isRentalMonth(startMonth) || !isRentalMonth(endMonth) || startMonth > endMonth) return [];
  const months: string[] = [];
  for (let cursor = startMonth; cursor <= endMonth; cursor = shiftMonth(cursor, 1)) months.push(cursor);
  return months;
}

export function bootstrapHistoricalRentPayments(args: {
  document: RentalDocument;
  property: Property;
  startMonth: string;
  endMonth: string;
  today: string;
}): HistoricalBootstrapResult {
  const { document, property, startMonth, endMonth, today } = args;
  const months = historicalMonths(startMonth, endMonth).filter((month) => month < today.slice(0, 7));
  const existingMonths = new Set(document.incomeEntries.filter((entry) => entry.propertyId === property.id)
    .map((entry) => entry.rentalMonth ?? entry.receivedAt.slice(0, 7)));
  const created: IncomeEntry[] = [];
  const skippedMonths: string[] = [];
  for (const month of months) {
    if (existingMonths.has(month)) { skippedMonths.push(month); continue; }
    if (property.rentalStartDate && month < property.rentalStartDate.slice(0, 7)) { skippedMonths.push(month); continue; }
    if (property.leaseEndDate && month > property.leaseEndDate.slice(0, 7)) { skippedMonths.push(month); continue; }
    const ownerGrosz = ownerRentForMonth(property, month) ?? (property.ownerRent ? moneyToGrosz(property.ownerRent) : null);
    if (ownerGrosz === null || ownerGrosz <= 0) { skippedMonths.push(month); continue; }
    const tenantMediaGrosz = property.mediaPaidByTenant ? moneyToGrosz(property.mediaAmount ?? "0") : 0;
    const expectedTenantGrosz = ownerGrosz + tenantMediaGrosz;
    if (!Number.isSafeInteger(expectedTenantGrosz)) throw new Error("Expected rent is too large");
    const day = Math.min(property.paymentDay ?? 5, daysInMonth(month));
    const estimatedReceivedAt = `${month}-${String(day).padStart(2, "0")}`;
    const receivedAt = property.rentalStartDate && estimatedReceivedAt < property.rentalStartDate ? property.rentalStartDate : estimatedReceivedAt;
    const amount = decimalFromGrosz(expectedTenantGrosz);
    const taxableAmount = decimalFromGrosz(defaultTaxableAmountGrosz({ property, amountGrosz: expectedTenantGrosz, rentalMonth: month, priorEntries: document.incomeEntries }));
    const entry = createIncomeEntry({
      propertyId: property.id,
      receivedAt,
      rentalMonth: month,
      amount,
      taxableAmount,
      description: "Wpłata początkowa",
      source: "INITIAL_IMPORT",
    }, property, initialIncomeId(property.id, month));
    // The current tenant is not evidence of who paid in a historical month.
    delete entry.tenantNameSnapshot;
    created.push(entry);
    existingMonths.add(month);
  }
  let properties = document.properties;
  if (created.length) {
    const firstImportedMonth = created[0]!.rentalMonth!;
    properties = document.properties.map((item) => {
      if (item.id !== property.id) return item;
      const hasRate = (item.rentSchedule ?? []).some((rate) => rate.effectiveFrom <= firstImportedMonth);
      const rentSchedule = hasRate || !item.ownerRent
        ? item.rentSchedule
        : [...(item.rentSchedule ?? []), { effectiveFrom: firstImportedMonth, amount: item.ownerRent }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      return {
        ...item,
        ...(rentSchedule ? { rentSchedule } : {}),
        ...(!item.rentalStartDate ? { rentalStartDate: `${firstImportedMonth}-01` } : {}),
      };
    });
  }
  return { document: { ...document, properties, incomeEntries: [...document.incomeEntries, ...created] }, created, skippedMonths };
}

function shiftMonth(month: string, delta: number) {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(year!, part! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function daysInMonth(month: string) {
  const [year, part] = month.split("-").map(Number);
  return new Date(year!, part!, 0).getDate();
}
function initialIncomeId(propertyId: string, month: string) {
  let hash = 2166136261;
  for (const char of `${propertyId}:${month}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `initial-${(hash >>> 0).toString(36)}`;
}
