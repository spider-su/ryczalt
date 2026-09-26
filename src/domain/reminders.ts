import type { IncomeEntry, Property } from "../model/rental";
import { expectedRentForMonth, rentMonthAmounts, taskNotificationPlan } from "./tasks";
import { moneyToGrosz } from "./ryczaltTax";

export type RentMonthSummary = {
  expectedGrosz: number;
  confirmedGrosz: number;
  remainingGrosz: number;
  status: "complete" | "check" | "unknown";
};

export function summarizeRentMonth(property: Property, entries: IncomeEntry[], rentalMonth: string, now = new Date()): RentMonthSummary {
  const expected = expectedRentForMonth(property, rentalMonth, now);
  const confirmed = entries.filter((entry) => entry.propertyId === property.id && entry.rentalMonth === rentalMonth)
    .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
  const remaining = expected === null ? 0 : Math.max(0, expected - confirmed);
  return { expectedGrosz: expected ?? 0, confirmedGrosz: confirmed, remainingGrosz: remaining,
    status: expected === null ? "unknown" : remaining === 0 ? "complete" : "check" };
}

export { rentMonthAmounts, taskNotificationPlan };
