import type { IncomeEntry, Property } from "../model/rental";
import { rentMonthAmounts, taskNotificationPlan } from "./tasks";

export type RentMonthSummary = {
  expectedGrosz: number;
  confirmedGrosz: number;
  remainingGrosz: number;
  unallocatedGrosz: number;
  status: "complete" | "check" | "unknown";
};

export function summarizeRentMonth(property: Property, entries: IncomeEntry[], rentalMonth: string, now = new Date()): RentMonthSummary {
  const { expectedGrosz, confirmedGrosz, remainingGrosz, unallocatedGrosz } = rentMonthAmounts(property, entries, rentalMonth, now);
  const remaining = remainingGrosz ?? 0;
  return { expectedGrosz: expectedGrosz ?? 0, confirmedGrosz, remainingGrosz: remaining,
    unallocatedGrosz, status: expectedGrosz === null ? "unknown" : remaining === 0 ? "complete" : "check" };
}

export { rentMonthAmounts, taskNotificationPlan };
