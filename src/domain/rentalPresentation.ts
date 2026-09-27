import type { AssistantTask } from "./tasks";
import type { IncomeEntry } from "../model/rental";
import { moneyToGrosz } from "./ryczaltTax";

export function primaryDashboardMetrics(received: string, remaining: string, tax: string) {
  return [
    { label: "Otrzymano", value: received },
    { label: "Pozostało", value: remaining },
    { label: "Podatek", value: tax },
  ];
}

export function incomeHistory(entries: IncomeEntry[], now = new Date(), propertyId: string | null = null) {
  return Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, index - 5);
    const total = entries.filter((entry) => entry.receivedAt.startsWith(month) && (!propertyId || entry.propertyId === propertyId))
      .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
    return { month, total };
  });
}

function shiftMonth(month: string, offset: number) { const [year, number] = month.split("-").map(Number); const date = new Date(year!, number! - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

export type RentDisplayState =
  | { kind: "unknown" }
  | { kind: "unpaid"; remainingGrosz: number }
  | { kind: "partial"; confirmedGrosz: number; expectedGrosz: number; remainingGrosz: number }
  | { kind: "paid"; expectedGrosz: number };

export function rentDisplayState(expectedGrosz: number | null, confirmedGrosz: number, remainingGrosz: number | null): RentDisplayState {
  if (expectedGrosz === null || remainingGrosz === null) return { kind: "unknown" };
  if (remainingGrosz === 0) return { kind: "paid", expectedGrosz };
  if (confirmedGrosz > 0) return { kind: "partial", confirmedGrosz, expectedGrosz, remainingGrosz };
  return { kind: "unpaid", remainingGrosz };
}

export function upcomingTasks(tasks: AssistantTask[], now = new Date(), limit = 4): AssistantTask[] {
  const cutoff = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
  return tasks
    .filter((task) => task.status === "upcoming" && task.dueAt >= now && task.dueAt <= cutoff)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
}

export function historicalTasks(tasks: AssistantTask[]): AssistantTask[] {
  return tasks.filter((task) => task.status === "completed" || task.status === "dismissed");
}

export const settingsSections = [
  { id: "properties", label: "Mieszkania" },
  { id: "tax", label: "Podatek i rozliczenia" },
  { id: "payment", label: "Dane do przelewu" },
  { id: "notifications", label: "Powiadomienia" },
  { id: "bills", label: "Pozostałe rachunki" },
  { id: "data", label: "Dane i kopia zapasowa" },
] as const;
