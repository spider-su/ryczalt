import type { IncomeEntry, Property } from "../model/rental";
import { defaultTaxableAmountGrosz, decimalFromGrosz } from "./apartmentPayments";
import { rentMonthAmounts } from "./rentAllocation";
import { createIncomeEntry } from "./rentalOperations";

export type BulkRentItem = { propertyId: string; address: string; tenantName?: string; amountGrosz: number };

export function defaultBulkSelection(items: BulkRentItem[]) { return items.map((item) => item.propertyId); }

export function toggleBulkSelection(selected: string[], propertyId: string) {
  return selected.includes(propertyId) ? selected.filter((id) => id !== propertyId) : [...selected, propertyId];
}

export function bulkSelectionTotal(items: BulkRentItem[], selected: string[]) {
  const ids = new Set(selected);
  return items.reduce((sum, item) => sum + (ids.has(item.propertyId) ? item.amountGrosz : 0), 0);
}

export function shiftRentalMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year!, monthNumber! - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function bulkRentItems(properties: Property[], entries: IncomeEntry[], month: string, now = new Date()): BulkRentItem[] {
  return properties.flatMap((property) => {
    if ((property.lifecycle ?? "ACTIVE") !== "ACTIVE") return [];
    if (property.paymentDay && dueDateFor(month, property.paymentDay) > localDate(now)) return [];
    const amounts = rentMonthAmounts(property, entries, month, now, monthsFromCurrent(month, now));
    if (amounts.expectedGrosz === null || amounts.remainingGrosz === null || amounts.remainingGrosz <= 0) return [];
    return [{ propertyId: property.id, address: property.address, tenantName: property.tenantName, amountGrosz: amounts.remainingGrosz }];
  });
}

function dueDateFor(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(Math.min(day, new Date(year!, monthNumber!, 0).getDate())).padStart(2, "0")}`;
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function makeBulkRentEntries(args: {
  properties: Property[];
  priorEntries: IncomeEntry[];
  selectedPropertyIds: string[];
  rentalMonth: string;
  receivedAt: string;
  now?: Date;
  createId: () => string;
}): IncomeEntry[] {
  const { properties, priorEntries, selectedPropertyIds, rentalMonth, receivedAt, now = new Date(), createId } = args;
  const selected = new Set(selectedPropertyIds);
  const pending = bulkRentItems(properties, priorEntries, rentalMonth, now).filter((item) => selected.has(item.propertyId));
  return pending.map((item) => {
    const property = properties.find(({ id }) => id === item.propertyId)!;
    const taxable = defaultTaxableAmountGrosz({ property, amountGrosz: item.amountGrosz, rentalMonth, priorEntries, now });
    return createIncomeEntry({
      propertyId: property.id,
      receivedAt,
      rentalMonth,
      amount: decimalFromGrosz(item.amountGrosz),
      taxableAmount: decimalFromGrosz(taxable),
      description: "Potwierdzenie czynszu",
    }, property, createId());
  });
}

function monthsFromCurrent(month: string, now: Date) {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, monthNumber] = month.split("-").map(Number);
  const [currentYear, currentMonth] = current.split("-").map(Number);
  return Math.max(6, (year! - currentYear!) * 12 + monthNumber! - currentMonth!);
}
