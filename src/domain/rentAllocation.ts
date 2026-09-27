import type { IncomeEntry, Property } from "../model/rental";
import { isRentalMonth } from "./rentalValidation";
import { moneyToGrosz } from "./ryczaltTax";

export type RentAllocation = {
  byMonth: ReadonlyMap<string, number>;
  unallocatedGrosz: number;
};

/**
 * Derive rent coverage without changing confirmed receipt records or their tax dates.
 * Explicit receipts cover their selected month first, then the oldest open
 * month that had fallen due by the receipt date. Unspecified receipts cover
 * the oldest open month due by their receipt date. Excess stays unallocated;
 * this avoids silently treating an overpayment as future rent.
 */
export function allocateRentReceipts(
  property: Property,
  entries: IncomeEntry[],
  now = new Date(),
  futureMonths = 6,
): RentAllocation {
  const currentMonth = localMonth(now);
  const receiptMonths = entries
    .filter((entry) => entry.propertyId === property.id)
    .map((entry) => entry.rentalMonth ?? entry.receivedAt.slice(0, 7))
    .filter(isRentalMonth);
  const scheduleMonths = (property.rentSchedule ?? []).map((rate) => rate.effectiveFrom).filter(isRentalMonth);
  const firstMonth = [currentMonth, ...receiptMonths, ...scheduleMonths].sort()[0]!;
  const lastMonth = [addMonths(currentMonth, futureMonths), ...receiptMonths].sort().at(-1)!;

  const expectedByMonth = new Map<string, number>();
  for (let month = firstMonth, guard = 0; month <= lastMonth && guard < 1200; month = addMonths(month, 1), guard += 1) {
    const expected = expectedRentForMonth(property, month, now);
    if (expected !== null && expected > 0) expectedByMonth.set(month, expected);
  }
  const confirmedByMonth = new Map<string, number>();
  const receipts = entries
    .filter((entry) => entry.propertyId === property.id)
    .slice()
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));

  for (const entry of receipts) {
    let remaining = moneyToGrosz(entry.amount);
    const months = [...expectedByMonth.keys()].sort();
    const receivedMonth = entry.receivedAt.slice(0, 7);
    const explicitMonth = validMonth(entry.rentalMonth);
    const historicalMonths = months.filter((month) => month <= receivedMonth && month !== explicitMonth);
    const relevant = explicitMonth
      ? [...months.filter((month) => month === explicitMonth), ...historicalMonths]
      : historicalMonths;
    for (const month of relevant) {
      if (remaining <= 0) break;
      const expected = expectedByMonth.get(month)!;
      const confirmed = confirmedByMonth.get(month) ?? 0;
      const allocated = Math.min(remaining, Math.max(0, expected - confirmed));
      if (allocated === 0) continue;
      confirmedByMonth.set(month, confirmed + allocated);
      remaining -= allocated;
    }
  }

  const totalReceipts = receipts.reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
  const totalAllocated = [...confirmedByMonth.values()].reduce((sum, amount) => sum + amount, 0);
  return { byMonth: confirmedByMonth, unallocatedGrosz: Math.max(0, totalReceipts - totalAllocated) };
}

export function expectedRentForMonth(property: Property, month: string, now = new Date()): number | null {
  if (!isRentalMonth(month)) return null;
  const rates = [...(property.rentSchedule ?? [])].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const applicable = rates.find((rate) => rate.effectiveFrom <= month);
  if (applicable) return moneyToGrosz(applicable.amount);
  const currentMonth = localMonth(now);
  if (!rates.length && month >= currentMonth && property.defaultMonthlyRent !== undefined) return moneyToGrosz(property.defaultMonthlyRent);
  return null;
}

export function rentMonthAmounts(property: Property, entries: IncomeEntry[], month: string, now = new Date()) {
  const expectedGrosz = expectedRentForMonth(property, month, now);
  const allocation = allocateRentReceipts(property, entries, now);
  const confirmedGrosz = allocation.byMonth.get(month) ?? 0;
  return {
    expectedGrosz,
    confirmedGrosz,
    remainingGrosz: expectedGrosz === null ? null : Math.max(0, expectedGrosz - confirmedGrosz),
    unallocatedGrosz: allocation.unallocatedGrosz,
  };
}

function validMonth(value?: string) { return value && isRentalMonth(value) ? value : undefined; }
function localMonth(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function addMonths(month: string, count: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year!, monthNumber! - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
