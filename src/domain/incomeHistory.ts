import type { IncomeEntry, Property } from "../model/rental";
import { moneyToGrosz } from "./ryczaltTax";
import { rentMonthAmounts } from "./rentAllocation";

export type IncomeMonthGroup = { month: string; totalGrosz: number; entries: IncomeEntry[] };
export type IncomeRangeSummary = { earliestMonth: string; latestMonth: string; monthCount: number; totalGrosz: number; paymentCount: number };
export type IncomeTimeMonth = { month: string; totalGrosz: number | null; period: "actual" | "future"; selected: boolean };

export function incomeEntriesForView(entries: IncomeEntry[], year: number, propertyId: string | null) {
  return entries.filter((entry) => entry.receivedAt.startsWith(`${year}-`) && (!propertyId || entry.propertyId === propertyId));
}

export function propertiesWithIncomeInYear(properties: Property[], entries: IncomeEntry[], year: number) {
  const propertyIds = new Set(entries.filter((entry) => entry.receivedAt.startsWith(`${year}-`)).map((entry) => entry.propertyId));
  return properties.filter((property) => propertyIds.has(property.id));
}

export function incomeViewSummary(entries: IncomeEntry[]) {
  return {
    totalGrosz: entries.reduce((total, entry) => total + moneyToGrosz(entry.taxableAmount), 0),
    count: entries.length,
    propertyCount: new Set(entries.map((entry) => entry.propertyId)).size,
  };
}

export function toggleIncomeMonth(expanded: string[], month: string): string[] {
  return expanded.includes(month) ? expanded.filter((item) => item !== month) : [...expanded, month];
}

export function incomeMonthStatus(totalGrosz: number, paymentCount: number, expectedGrosz: number | null) {
  return {
    completion: expectedGrosz === null ? "unknown" as const : totalGrosz >= expectedGrosz ? "complete" as const : "incomplete" as const,
    paymentLabel: `${paymentCount} ${paymentCount === 1 ? "wpłata" : "wpłaty"}`,
  };
}

export type RentMonthStatus = {
  propertyId: string;
  address: string;
  expectedGrosz: number | null;
  confirmedGrosz: number;
  remainingGrosz: number | null;
  status: "unknown" | "unpaid" | "partial" | "paid";
};

/** Projects each apartment's rental-month status without synthesizing receipt records. */
export function rentMonthStatusRows(properties: Property[], entries: IncomeEntry[], month: string, now = new Date()): RentMonthStatus[] {
  return properties.map((property) => {
    const amounts = rentMonthAmounts(property, entries, month, now);
    const status = amounts.expectedGrosz === null || amounts.remainingGrosz === null
      ? "unknown" as const
      : amounts.remainingGrosz === 0 ? "paid" as const
        : amounts.confirmedGrosz > 0 ? "partial" as const : "unpaid" as const;
    return { propertyId: property.id, address: property.address, expectedGrosz: amounts.expectedGrosz,
      confirmedGrosz: amounts.confirmedGrosz, remainingGrosz: amounts.remainingGrosz, status };
  }).filter((row) => row.expectedGrosz !== null || row.confirmedGrosz > 0);
}

export function groupIncomeEntriesByReceivedMonth(entries: IncomeEntry[]): IncomeMonthGroup[] {
  const groups = new Map<string, IncomeEntry[]>();
  entries.forEach((entry) => {
    const month = entry.receivedAt.slice(0, 7);
    const group = groups.get(month) ?? [];
    group.push(entry);
    groups.set(month, group);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, monthEntries]) => {
      const sortedEntries = monthEntries
        .map((entry, index) => ({ entry, index }))
        .sort((left, right) => right.entry.receivedAt.localeCompare(left.entry.receivedAt) || left.index - right.index)
        .map(({ entry }) => entry);
      return {
        month,
        totalGrosz: sortedEntries.reduce((total, entry) => total + moneyToGrosz(entry.amount), 0),
        entries: sortedEntries,
      };
    });
}

/** Older received-month groups only; current-period rent status is shown separately. */
export function historicalIncomeGroups(groups: IncomeMonthGroup[], selectedMonth: string): IncomeMonthGroup[] {
  return groups.filter(({ month }) => month < selectedMonth);
}

/** Summarizes real payment records in represented historical months. */
export function incomeRangeSummary(groups: IncomeMonthGroup[]): IncomeRangeSummary | null {
  if (groups.length === 0) return null;
  const months = groups.map(({ month }) => month).sort();
  const entries = groups.flatMap(({ entries: monthEntries }) => monthEntries);
  return {
    earliestMonth: months[0]!,
    latestMonth: months.at(-1)!,
    monthCount: new Set(months).size,
    totalGrosz: entries.reduce((total, entry) => total + moneyToGrosz(entry.amount), 0),
    paymentCount: entries.length,
  };
}

/** Seven-month chart around the current month, or December for a selected past year. */
export function incomeTimeWindow(entries: IncomeEntry[], now = new Date(), propertyId: string | null = null, selectedYear = now.getFullYear()): IncomeTimeMonth[] {
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = selectedYear === now.getFullYear() ? currentMonth : `${selectedYear}-12`;
  return Array.from({ length: 7 }, (_, index) => {
    const month = shiftMonth(selectedMonth, index - 3);
    const future = month > currentMonth;
    const totalGrosz = future ? null : entries
      .filter((entry) => entry.receivedAt.startsWith(month) && (!propertyId || entry.propertyId === propertyId))
      .reduce((total, entry) => total + moneyToGrosz(entry.amount), 0);
    return { month, totalGrosz, period: future ? "future" as const : "actual" as const, selected: month === selectedMonth };
  });
}

function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year!, number! - 1 + offset, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
