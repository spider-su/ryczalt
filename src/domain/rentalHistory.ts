import type { IncomeEntry } from "../model/rental";

export function entriesForTaxYear(
  entries: IncomeEntry[],
  taxYear: number,
): IncomeEntry[] {
  const prefix = `${taxYear}-`;
  return entries
    .filter((entry) => entry.receivedAt.startsWith(prefix))
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}
