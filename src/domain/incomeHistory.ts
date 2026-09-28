import type { IncomeEntry, Property } from "../model/rental";
import { formatPln, moneyToGrosz } from "./ryczaltTax";
import { rentMonthAmounts } from "./rentAllocation";

export type IncomeMonthGroup = { month: string; totalGrosz: number; entries: IncomeEntry[] };

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

export function defaultExpandedIncomeMonths(months: string[], currentMonth: string): string[] {
  return months.includes(currentMonth) ? [currentMonth] : [];
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

export function currentMonthIncomeLabel(month: string, confirmedGrosz: number, expectedGrosz: number): string {
  const monthLabel = new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 12));
  return `${monthLabel} · otrzymano ${formatPln(confirmedGrosz)} · oczekiwany czynsz ${formatPln(expectedGrosz)}`;
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
