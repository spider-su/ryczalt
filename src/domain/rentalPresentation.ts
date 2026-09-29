import type { AssistantTask } from "./tasks";
import type { IncomeEntry } from "../model/rental";
import { formatPln, moneyToGrosz, RYCZALT_RULES } from "./ryczaltTax";
import { formatPolishCount, formatPolishMonth } from "./presentationFormat";

export function primaryDashboardMetrics(received: string, remaining: string, tax: string) {
  return [
    { label: "Otrzymano", value: received },
    { label: "Pozostało", value: remaining },
    { label: "Podatek", value: tax },
  ];
}

export function incomeHistory(entries: IncomeEntry[], now = new Date(), propertyId: string | null = null, selectedYear?: number) {
  const year = selectedYear ?? now.getFullYear();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const endMonth = selectedYear === undefined || selectedYear === now.getFullYear()
    ? currentYearMonth
    : `${selectedYear}-12`;
  return Array.from({ length: 6 }, (_, index) => {
    const month = shiftMonth(endMonth, index - 5);
    const total = entries.filter((entry) => entry.receivedAt.startsWith(`${year}-`) && entry.receivedAt.startsWith(month) && (!propertyId || entry.propertyId === propertyId))
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

export function rentStatusLabel(state: RentDisplayState): string {
  if (state.kind === "unknown") return "Nieustalony";
  if (state.kind === "paid") return "Potwierdzone";
  if (state.kind === "partial") return "Częściowo otrzymano";
  return "Do potwierdzenia";
}

export function rentCheckAgeLabel(days: number): string | null {
  if (days <= 0) return null;
  const unit = days === 1 ? "dzień" : "dni";
  return `Termin sprawdzenia minął ${days} ${unit} temu`;
}

export function dashboardProgress(value: number, total: number) {
  const safeTotal = Math.max(0, total);
  const safeValue = Math.max(0, value);
  return { value: safeValue, total: safeTotal, fraction: safeTotal === 0 ? 0 : Math.min(1, safeValue / safeTotal) };
}

export function daysOverdue(month: string, day: number, now: Date) {
  const [year, monthNumber] = month.split("-").map(Number);
  const due = new Date(year!, monthNumber! - 1, Math.min(day, new Date(year!, monthNumber!, 0).getDate()));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

export function annualRentalIncome(entries: IncomeEntry[], taxYear: number, openingRevenueGrosz = 0) {
  return entries.filter((entry) => entry.receivedAt.startsWith(`${taxYear}-`))
    .reduce((sum, entry) => sum + moneyToGrosz(entry.taxableAmount), openingRevenueGrosz);
}

export function annualRentalThreshold(taxYear: number, jointSpouseThreshold = false) {
  const rules = RYCZALT_RULES[taxYear as keyof typeof RYCZALT_RULES];
  return rules ? rules.lowerLimitPln * 100 * (jointSpouseThreshold ? 2 : 1) : 0;
}

export function rentConfirmationGroups<T extends { state: RentDisplayState }>(items: T[]) {
  const pending = items.filter(({ state }) => state.kind !== "paid");
  return { pending, allPaid: items.length > 0 && pending.length === 0 };
}

export function unallocatedRentWarning(unallocatedGrosz: number): string | null {
  return unallocatedGrosz > 0
    ? `Nieprzypisana nadpłata: ${formatPln(unallocatedGrosz)}`
    : null;
}

export function incomeSectionLabels(currentMonth: string, selectedYear: number) {
  const currentPeriod = formatPolishMonth(currentMonth).toLocaleUpperCase("pl-PL");
  return {
    currentRent: `DO POTWIERDZENIA · ${currentPeriod}`,
    paymentHistory: `POTWIERDZONE WPŁATY · ${selectedYear}`,
  };
}

export function attentionSummary(count: number) {
  return count > 0
    ? { interactive: true, label: `${formatPolishCount(count, ["sprawa", "sprawy", "spraw"])} ${count === 1 ? "wymaga" : "wymagają"} uwagi`, action: "Pokaż ›" }
    : { interactive: false, label: "✓ Wszystko na dziś załatwione", action: null };
}

export function dashboardTaskPresentation(attentionCount: number) {
  return {
    showActionableSection: attentionCount > 0,
    summary: attentionSummary(attentionCount),
  };
}

/** Operational tasks needing action; rent checks are presented with the selected month's rent status. */
export function dashboardAttentionTasks(tasks: AssistantTask[]) {
  return tasks.filter((task) => task.status === "needs-attention" && task.type !== "TENANT_PAYMENT_CHECK");
}

export function dashboardTaxIssueSummary(tasks: AssistantTask[], now = new Date()) {
  const overdue = tasks.filter((task) => task.type === "TAX_PAYMENT" && task.status === "needs-attention" && task.dueAt < now);
  return overdue.length > 1
    ? { count: overdue.length, totalGrosz: overdue.reduce((total, task) => total + (task.remainingGrosz ?? 0), 0) }
    : null;
}

export function rentIncomeAction(remainingRentGrosz: number) {
  const urgent = remainingRentGrosz > 0;
  return {
    primary: urgent,
    label: urgent ? "Potwierdź wpłatę" : "Dodaj inną wpłatę",
  };
}

export function upcomingTaskPresentation(task: AssistantTask) {
  const title = task.type === "TAX_PAYMENT"
    ? "Podatek"
    : task.type === "TENANT_PAYMENT_CHECK"
      ? task.title.replace(/^Sprawdź czynsz — /, "")
      : task.title;
  const amountGrosz = task.type === "TENANT_PAYMENT_CHECK"
    ? task.expectedGrosz
    : task.type === "TAX_PAYMENT"
      ? task.remainingGrosz ?? task.expectedGrosz
      : undefined;
  return { title, amount: amountGrosz === undefined ? "" : formatPln(amountGrosz) };
}

export function taxPaymentPrompt(outstandingGrosz: number, overpaidGrosz: number, obligationGrosz = 0) {
  if (outstandingGrosz > 0) return { showPayment: true, status: null };
  return {
    showPayment: false,
    status: overpaidGrosz > 0 ? "Nadpłata — nie dodawaj kolejnej wpłaty" : obligationGrosz > 0 ? "Podatek za okres rozliczony" : "Brak podatku do zapłaty",
  };
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
  { id: "data", label: "Dane lokalne" },
] as const;
