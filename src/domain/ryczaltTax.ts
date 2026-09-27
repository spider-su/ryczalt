import type { IncomeEntry, TaxPayment } from "../model/rental";

export const RYCZALT_RULES = {
  2025: { lowerLimitPln: 100_000, lowerRate: 85, upperRate: 125 },
  2026: { lowerLimitPln: 100_000, lowerRate: 85, upperRate: 125 },
} as const;
export const SUPPORTED_TAX_YEARS = Object.keys(RYCZALT_RULES).map(Number) as (keyof typeof RYCZALT_RULES)[];

export type SettlementMode = "monthly" | "quarterly";
/** Resolve the settlement bucket containing a calendar month. */
export function settlementPeriodForMonth(month: string, mode: SettlementMode): string | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;
  if (mode === "monthly") return month;
  const quarter = Math.ceil(Number(match[2]) / 3);
  return `${match[1]}-Q${quarter}`;
}

export type Settlement = {
  period: string;
  revenueGrosz: number;
  cumulativeRevenueGrosz: number;
  obligationGrosz: number;
  cumulativeTaxGrosz: number;
  paidGrosz: number;
  creditAppliedGrosz: number;
  outstandingGrosz: number;
  overpaidGrosz: number;
  dueDate: string;
  status: "no-tax" | "due" | "partial" | "paid" | "overdue";
};

export function moneyToGrosz(amount: string): number {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amount))
    throw new Error("Invalid PLN amount");
  const [whole, fraction = ""] = amount.split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value)) throw new Error("PLN amount is too large");
  return value;
}

export function formatPln(grosz: number): string {
  const sign = grosz < 0 ? "-" : "";
  const absolute = Math.abs(grosz);
  const whole = new Intl.NumberFormat("pl-PL", { useGrouping: "always", maximumFractionDigits: 0 }).format(Math.floor(absolute / 100));
  return `${sign}${whole},${String(absolute % 100).padStart(2, "0")} zł`;
}

export function taxOnRevenue(
  cumulativeRevenueGrosz: number,
  taxYear: number,
  jointSpouseThreshold = false,
): number {
  if (!Number.isSafeInteger(cumulativeRevenueGrosz) || cumulativeRevenueGrosz < 0)
    throw new Error("Revenue amount is out of range");
  const rules = RYCZALT_RULES[taxYear as keyof typeof RYCZALT_RULES];
  if (!rules) throw new Error(`Tax rules for ${taxYear} are not available`);
  const limit = rules.lowerLimitPln * (jointSpouseThreshold ? 2 : 1) * 100;
  const lower = Math.min(cumulativeRevenueGrosz, limit);
  const upper = Math.max(0, cumulativeRevenueGrosz - limit);
  return roundTaxNumerator(BigInt(lower) * BigInt(rules.lowerRate) + BigInt(upper) * BigInt(rules.upperRate));
}

export function calculateSettlements(args: {
  entries: IncomeEntry[];
  payments: TaxPayment[];
  taxYear: number;
  mode: SettlementMode;
  jointSpouseThreshold?: boolean;
  today?: string;
}): Settlement[] {
  const { entries, payments, taxYear, mode, jointSpouseThreshold = false } = args;
  const now = new Date();
  const today = args.today ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const periods = Array.from({ length: mode === "monthly" ? 12 : 4 }, (_, i) =>
    mode === "monthly"
      ? `${taxYear}-${String(i + 1).padStart(2, "0")}`
      : `${taxYear}-Q${i + 1}`,
  );
  let cumulativeRevenueGrosz = 0;
  let previousTaxGrosz = 0;
  const paymentTotals = periods.map((period) => payments
    .filter((payment) => payment.period === period)
    .reduce((total, payment) => {
      const next = total + moneyToGrosz(payment.amount);
      if (!Number.isSafeInteger(next)) throw new Error("Tax payments are too large");
      return next;
    }, 0));
  const unpaidByPeriod = new Map<number, number>();
  let taxCreditGrosz = 0;
  const settlements = periods.map((period, index) => {
    const periodEntries = entries.filter((entry) => {
      if (!entry.receivedAt.startsWith(`${taxYear}-`)) return false;
      const month = Number(entry.receivedAt.slice(5, 7));
      return mode === "monthly"
        ? period === entry.receivedAt.slice(0, 7)
        : Math.ceil(month / 3) === index + 1;
    });
    const revenueGrosz = periodEntries.reduce((total, entry) => {
      const next = total + moneyToGrosz(entry.taxableAmount);
      if (!Number.isSafeInteger(next)) throw new Error("Period revenue is too large");
      return next;
    }, 0);
    const taxRules = RYCZALT_RULES[taxYear as keyof typeof RYCZALT_RULES];
    if (!taxRules) throw new Error(`Tax rules for ${taxYear} are not available`);
    const threshold = taxRules.lowerLimitPln * (jointSpouseThreshold ? 2 : 1) * 100;
    const lowerBandGrosz = Math.min(revenueGrosz, Math.max(0, threshold - cumulativeRevenueGrosz));
    const upperBandGrosz = revenueGrosz - lowerBandGrosz;
    const obligationGrosz = roundTaxNumerator(BigInt(lowerBandGrosz) * BigInt(taxRules.lowerRate) + BigInt(upperBandGrosz) * BigInt(taxRules.upperRate));
    cumulativeRevenueGrosz += revenueGrosz;
    if (!Number.isSafeInteger(cumulativeRevenueGrosz)) throw new Error("Annual revenue is too large");
    const cumulativeTaxGrosz = previousTaxGrosz + obligationGrosz;
    if (!Number.isSafeInteger(cumulativeTaxGrosz)) throw new Error("Calculated tax is too large");
    previousTaxGrosz = cumulativeTaxGrosz;
    let outstandingGrosz = obligationGrosz;
    const creditUsedGrosz = Math.min(taxCreditGrosz, outstandingGrosz);
    taxCreditGrosz -= creditUsedGrosz;
    outstandingGrosz -= creditUsedGrosz;
    unpaidByPeriod.set(index, outstandingGrosz);

    let remainingPaymentGrosz = paymentTotals[index]!;
    for (let prior = 0; prior <= index && remainingPaymentGrosz > 0; prior += 1) {
      const unpaid = unpaidByPeriod.get(prior) ?? 0;
      const applied = Math.min(unpaid, remainingPaymentGrosz);
      unpaidByPeriod.set(prior, unpaid - applied);
      remainingPaymentGrosz -= applied;
    }
    const overpaidGrosz = remainingPaymentGrosz;
    taxCreditGrosz += overpaidGrosz;
    if (!Number.isSafeInteger(taxCreditGrosz)) throw new Error("Tax payments are too large");
    const dueDate = paymentDeadline(taxYear, index, mode);
    const paidGrosz = paymentTotals[index]!;
    return { period, revenueGrosz, cumulativeRevenueGrosz, obligationGrosz,
      cumulativeTaxGrosz, paidGrosz, creditAppliedGrosz: creditUsedGrosz, outstandingGrosz: unpaidByPeriod.get(index) ?? 0,
      overpaidGrosz, dueDate, status: "due" as const };
  });
  return settlements.map((settlement, index) => {
    const outstandingGrosz = unpaidByPeriod.get(index) ?? 0;
    const status: Settlement["status"] = settlement.obligationGrosz <= 0
      ? "no-tax"
      : outstandingGrosz === 0
        ? "paid"
        : outstandingGrosz < settlement.obligationGrosz
          ? "partial"
          : today > settlement.dueDate
            ? "overdue"
            : "due";
    return { ...settlement, outstandingGrosz, status };
  });
}

function roundTaxNumerator(groszTimesThousandths: bigint): number {
  const rounded = ((groszTimesThousandths + 50_000n) / 100_000n) * 100n;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Calculated tax is too large");
  return result;
}

function paymentDeadline(year: number, index: number, mode: SettlementMode): string {
  const month = mode === "monthly" ? index + 2 : (index + 1) * 3 + 1;
  const due = new Date(Date.UTC(year + Math.floor((month - 1) / 12), (month - 1) % 12, 20));
  while (isPolishNonWorkingDay(due)) due.setUTCDate(due.getUTCDate() + 1);
  return due.toISOString().slice(0, 10);
}

function isPolishNonWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return true;
  const fixed = new Set(["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-24", "12-25", "12-26"]);
  if (fixed.has(date.toISOString().slice(5, 10))) return true;
  const easter = easterSunday(date.getUTCFullYear());
  return date.getTime() === easter.getTime() + 86400000 ||
    date.getTime() === easter.getTime() + 60 * 86400000;
}

function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1));
}
