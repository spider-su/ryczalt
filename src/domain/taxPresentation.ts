import type { Settlement, SettlementMode } from "./ryczaltTax";
import { formatPolishMonth } from "./presentationFormat";

export function shiftTaxPeriod(period: string, offset: number, mode: SettlementMode): string {
  const match = /^(\d{4})-(\d{2}|Q[1-4])$/.exec(period);
  if (!match) return period;
  const year = Number(match[1]);
  const value = match[2];
  if (!value) return period;
  if (mode === "monthly") {
    const month = Number(value);
    const date = new Date(year, month - 1 + offset, 1, 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  const quarter = Number(value.slice(1));
  const date = new Date(year, (quarter - 1) * 3 + offset * 3, 1, 12);
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

export function currentTaxPeriod(now = new Date(), mode: SettlementMode = "monthly") {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return mode === "monthly" ? month : `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

export function taxPeriodsForYear(year: number, mode: SettlementMode, now = new Date(), earliestPeriod = "2025-01") {
  const currentYear = now.getFullYear();
  if (year > currentYear) return [];
  const count = mode === "monthly" ? (year === currentYear ? now.getMonth() + 1 : 12) : (year === currentYear ? Math.ceil((now.getMonth() + 1) / 3) : 4);
  return Array.from({ length: count }, (_, index) => mode === "monthly"
    ? `${year}-${String(index + 1).padStart(2, "0")}`
    : `${year}-Q${index + 1}`).filter((period) => period >= earliestPeriod);
}

export function shiftTaxPeriodWithinRange(period: string, offset: number, mode: SettlementMode, now = new Date(), earliestPeriod = "2025-01") {
  const shifted = shiftTaxPeriod(period, offset, mode);
  const latest = currentTaxPeriod(now, mode);
  return shifted > latest ? latest : shifted < earliestPeriod ? earliestPeriod : shifted;
}

export function remainingTaxThresholdGrosz(incomeGrosz: number, thresholdGrosz: number) {
  return Math.max(0, thresholdGrosz - incomeGrosz);
}

export const TAX_TRANSFER_HINT = "PPE · mikrorachunek podatkowy";
export const TAX_CALCULATION_EXPLANATION = "Podatek wynika z potwierdzonych wpływów przypisanych do okresu, uwzględnia zapisane wpłaty podatku oraz saldo otwarcia skonfigurowane dla roku. To wyliczenie pomocnicze i nie uwzględnia indywidualnych odliczeń.";
export const TAX_PAYMENT_ALLOCATION_HINT = "Wpłaty są zaliczane od najstarszej nierozliczonej należności. Wpłata zarejestrowana dla tego okresu mogła pokryć wcześniejszy okres.";

export function taxPeriodLabel(period: string, mode: SettlementMode): string {
  if (mode === "monthly") return formatPolishMonth(period);
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) return period;
  return `${["I", "II", "III", "IV"][Number(match[2]) - 1] ?? match[2]} kwartał ${match[1]}`;
}

export function taxRateLabel(cumulativeRevenueGrosz: number, thresholdGrosz: number): string {
  return cumulativeRevenueGrosz > thresholdGrosz ? "8,5% / 12,5%" : "8,5%";
}

export type TaxPaymentDisplay = {
  kind: "no-tax" | "paid" | "due" | "partial" | "overdue";
  obligationGrosz: number;
  paidGrosz: number;
  remainingGrosz: number;
  dueDate: string;
  viaCredit: boolean;
};

export function taxPaymentDisplay(settlement: Settlement): TaxPaymentDisplay {
  if (settlement.obligationGrosz === 0) return { kind: "no-tax", obligationGrosz: 0, paidGrosz: 0, remainingGrosz: 0, dueDate: settlement.dueDate, viaCredit: false };
  const paidGrosz = settlement.allocatedPaidGrosz;
  if (settlement.outstandingGrosz === 0) return {
    kind: "paid", obligationGrosz: settlement.obligationGrosz, paidGrosz,
    remainingGrosz: 0, dueDate: settlement.dueDate,
    viaCredit: settlement.paidGrosz < settlement.obligationGrosz || settlement.creditAppliedGrosz > 0,
  };
  return {
    kind: settlement.status === "overdue" ? "overdue" : paidGrosz > 0 ? "partial" : "due",
    obligationGrosz: settlement.obligationGrosz, paidGrosz,
    remainingGrosz: settlement.outstandingGrosz, dueDate: settlement.dueDate,
    viaCredit: false,
  };
}

export function previousOutstandingTax(settlements: Settlement[], currentPeriod: string) {
  const previous = settlements.filter((item) => item.period < currentPeriod && item.outstandingGrosz > 0);
  return {
    count: previous.length,
    totalGrosz: previous.reduce((total, item) => total + item.outstandingGrosz, 0),
  };
}

export function taxSummaryForPeriod(settlements: Settlement[], currentPeriod: string) {
  const current = settlements.find((item) => item.period === currentPeriod) ?? null;
  return {
    current,
    previousOutstanding: current ? previousOutstandingTax(settlements, current.period) : { count: 0, totalGrosz: 0 },
  };
}
