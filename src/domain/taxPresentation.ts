import type { SettlementMode } from "./ryczaltTax";
import type { Settlement } from "./ryczaltTax";
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

export function taxPeriodLabel(period: string, mode: SettlementMode): string {
  if (mode === "monthly") return formatPolishMonth(period);
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) return period;
  return `${["I", "II", "III", "IV"][Number(match[2]) - 1] ?? match[2]} kwartał ${match[1]}`;
}

export function taxRateLabel(cumulativeRevenueGrosz: number, thresholdGrosz: number): string {
  return cumulativeRevenueGrosz > thresholdGrosz ? "8,5% / 12,5%" : "8,5%";
}

export type TaxPaymentDisplay =
  | { kind: "no-tax" }
  | { kind: "paid"; amountGrosz: number; paidAt?: string; viaCredit: boolean }
  | { kind: "due" | "partial" | "overdue"; amountGrosz: number; paidGrosz: number; obligationGrosz: number; dueDate: string };

export function taxPaymentDisplay(settlement: Settlement, latestPaymentDate?: string): TaxPaymentDisplay {
  if (settlement.obligationGrosz === 0) return { kind: "no-tax" };
  if (settlement.outstandingGrosz === 0) return {
    kind: "paid", amountGrosz: settlement.obligationGrosz,
    ...(latestPaymentDate ? { paidAt: latestPaymentDate } : {}),
    viaCredit: settlement.paidGrosz < settlement.obligationGrosz,
  };
  return {
    kind: settlement.status === "overdue" ? "overdue" : settlement.paidGrosz > 0 ? "partial" : "due",
    amountGrosz: settlement.outstandingGrosz, paidGrosz: settlement.paidGrosz,
    obligationGrosz: settlement.obligationGrosz, dueDate: settlement.dueDate,
  };
}
