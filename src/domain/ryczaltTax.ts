import type { IncomeEntry, TaxPayment } from "../model/rental";

export const RYCZALT_RULES = {
  2025: { lowerLimitPln: 100_000, lowerRate: 85, upperRate: 125 },
  2026: { lowerLimitPln: 100_000, lowerRate: 85, upperRate: 125 },
} as const;
export const SUPPORTED_TAX_YEARS = Object.keys(RYCZALT_RULES).map(Number) as (keyof typeof RYCZALT_RULES)[];
export function hasTaxRulesForYear(year: number): boolean {
  return year >= Math.min(...SUPPORTED_TAX_YEARS);
}
/** Select verified year-specific rules, or the latest verified year provisionally for future years. */
export function taxRulesYearFor(year: number): number {
  if (!Number.isInteger(year) || year < Math.min(...SUPPORTED_TAX_YEARS)) throw new Error(`Tax rules for ${year} are not available`);
  if (Object.prototype.hasOwnProperty.call(RYCZALT_RULES, year)) return year;
  const latest = Math.max(...SUPPORTED_TAX_YEARS);
  if (year > latest) return latest;
  throw new Error(`Tax rules for ${year} are not available`);
}
export function taxRulesAreProvisional(year: number): boolean {
  return taxRulesYearFor(year) !== year;
}
export function taxNavigationYears(now = new Date(), firstYear = 2025): number[] {
  return Array.from({ length: Math.max(0, now.getFullYear() - firstYear + 1) }, (_, index) => firstYear + index);
}

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
  rulesYear: number;
  revenueGrosz: number;
  taxableBaseGrosz: number;
  cumulativeRevenueGrosz: number;
  obligationGrosz: number;
  cumulativeTaxGrosz: number;
  /** Confirmed payments and carried credits allocated to this period's obligation. */
  allocatedPaidGrosz: number;
  /** Payments recorded for this period, before oldest-outstanding allocation. */
  paidGrosz: number;
  creditAppliedGrosz: number;
  outstandingGrosz: number;
  overpaidGrosz: number;
  dueDate: string;
  status: "no-tax" | "due" | "partial" | "paid" | "overdue";
};

export type OpeningTaxBalance = {
  taxableRevenueGrosz: number;
  calculatedTaxGrosz: number;
  paidTaxGrosz: number;
  outstandingGrosz: number;
  overpaidGrosz: number;
};

export type TaxYearCalculation = {
  openingBalance: OpeningTaxBalance;
  settlements: Settlement[];
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

/** Format a validated PLN amount stored as a decimal string. */
export function formatPlnAmount(amount: string): string {
  return formatPln(moneyToGrosz(amount));
}

/** Date used for tax deadline statuses, independent of the device's timezone. */
export function todayInPoland(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Ordynacja podatkowa rounds tax bases to whole PLN; 50 grosz rounds up. */
export function roundTaxBaseGrosz(amountGrosz: number): number {
  if (!Number.isSafeInteger(amountGrosz) || amountGrosz < 0)
    throw new Error("Tax base amount is out of range");
  const rounded = ((BigInt(amountGrosz) + 50n) / 100n) * 100n;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new Error("Tax base amount is too large");
  return result;
}

export function taxOnRevenue(
  cumulativeRevenueGrosz: number,
  taxYear: number,
  jointSpouseThreshold = false,
): number {
  if (!Number.isSafeInteger(cumulativeRevenueGrosz) || cumulativeRevenueGrosz < 0)
    throw new Error("Revenue amount is out of range");
  const rules = RYCZALT_RULES[taxRulesYearFor(taxYear) as keyof typeof RYCZALT_RULES];
  const taxableBaseGrosz = roundTaxBaseGrosz(cumulativeRevenueGrosz);
  return taxOnBaseAfter(taxableBaseGrosz, 0, rules, jointSpouseThreshold);
}

export function calculateSettlements(args: {
  entries: IncomeEntry[];
  payments: TaxPayment[];
  taxYear: number;
  mode: SettlementMode;
  jointSpouseThreshold?: boolean;
  openingTaxableRevenueGrosz?: number;
  openingTaxPaidGrosz?: number;
  today?: string;
}): Settlement[] {
  return calculateTaxYear(args).settlements;
}

/** Calculates the aggregate opening position separately from dated settlements. */
export function calculateTaxYear(args: {
  entries: IncomeEntry[];
  payments: TaxPayment[];
  taxYear: number;
  mode: SettlementMode;
  jointSpouseThreshold?: boolean;
  openingTaxableRevenueGrosz?: number;
  openingTaxPaidGrosz?: number;
  today?: string;
}): TaxYearCalculation {
  const { entries, payments, taxYear, mode, jointSpouseThreshold = false } = args;
  const rulesYear = taxRulesYearFor(taxYear);
  const taxRules = RYCZALT_RULES[rulesYear as keyof typeof RYCZALT_RULES];
  const now = new Date();
  const today = args.today ?? todayInPoland(now);
  const periods = Array.from({ length: mode === "monthly" ? 12 : 4 }, (_, i) =>
    mode === "monthly"
      ? `${taxYear}-${String(i + 1).padStart(2, "0")}`
      : `${taxYear}-Q${i + 1}`,
  );
  const openingRevenueGrosz = args.openingTaxableRevenueGrosz ?? 0;
  const openingTaxPaidGrosz = args.openingTaxPaidGrosz ?? 0;
  if (![openingRevenueGrosz, openingTaxPaidGrosz].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("Opening tax balance is out of range");
  const openingTaxGrosz = taxOnRevenue(openingRevenueGrosz, taxYear, jointSpouseThreshold);
  const openingBalance: OpeningTaxBalance = {
    taxableRevenueGrosz: openingRevenueGrosz,
    calculatedTaxGrosz: openingTaxGrosz,
    paidTaxGrosz: openingTaxPaidGrosz,
    outstandingGrosz: Math.max(0, openingTaxGrosz - openingTaxPaidGrosz),
    overpaidGrosz: Math.max(0, openingTaxPaidGrosz - openingTaxGrosz),
  };
  let cumulativeRevenueGrosz = openingRevenueGrosz;
  let cumulativeTaxableBaseGrosz = roundTaxBaseGrosz(openingRevenueGrosz);
  let previousTaxGrosz = openingTaxGrosz;
  const paymentTotals = periods.map((period) => payments
    .filter((payment) => payment.period === period)
    .reduce((total, payment) => {
      const next = total + moneyToGrosz(payment.amount);
      if (!Number.isSafeInteger(next)) throw new Error("Tax payments are too large");
      return next;
    }, 0));
  const unpaidByPeriod = new Map<number, number>();
  // Aggregate opening amounts have no known settlement period. They inform the
  // cumulative annual position but cannot alter a dated monthly obligation.
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
    const taxableBaseGrosz = roundTaxBaseGrosz(revenueGrosz);
    const periodObligationGrosz = taxOnBaseAfter(taxableBaseGrosz, cumulativeTaxableBaseGrosz, taxRules, jointSpouseThreshold);
    const obligationGrosz = periodObligationGrosz;
    cumulativeRevenueGrosz += revenueGrosz;
    if (!Number.isSafeInteger(cumulativeRevenueGrosz)) throw new Error("Annual revenue is too large");
    cumulativeTaxableBaseGrosz += taxableBaseGrosz;
    if (!Number.isSafeInteger(cumulativeTaxableBaseGrosz)) throw new Error("Annual taxable base is too large");
    const cumulativeTaxGrosz = previousTaxGrosz + periodObligationGrosz;
    if (!Number.isSafeInteger(cumulativeTaxGrosz)) throw new Error("Calculated tax is too large");
    previousTaxGrosz = cumulativeTaxGrosz;
    let outstandingGrosz = obligationGrosz;
    const creditUsedGrosz = Math.min(taxCreditGrosz, outstandingGrosz);
    taxCreditGrosz -= creditUsedGrosz;
    outstandingGrosz -= creditUsedGrosz;
    unpaidByPeriod.set(index, (unpaidByPeriod.get(index) ?? 0) + outstandingGrosz);

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
    const outstandingForPeriodGrosz = unpaidByPeriod.get(index) ?? 0;
    return { period, rulesYear, revenueGrosz, taxableBaseGrosz, cumulativeRevenueGrosz, obligationGrosz,
      cumulativeTaxGrosz, allocatedPaidGrosz: obligationGrosz - outstandingForPeriodGrosz, paidGrosz,
      creditAppliedGrosz: creditUsedGrosz, outstandingGrosz: outstandingForPeriodGrosz,
      overpaidGrosz, dueDate, status: "due" as const };
  });
  return { openingBalance, settlements: settlements.map((settlement, index) => {
    const outstandingGrosz = unpaidByPeriod.get(index) ?? 0;
    const status: Settlement["status"] = settlement.obligationGrosz <= 0
      ? "no-tax"
      : outstandingGrosz === 0
        ? "paid"
        : today > settlement.dueDate
          ? "overdue"
          : outstandingGrosz < settlement.obligationGrosz
            ? "partial"
            : "due";
    return { ...settlement, allocatedPaidGrosz: settlement.obligationGrosz - outstandingGrosz, outstandingGrosz, status };
  }) };
}

function taxOnBaseAfter(
  taxableBaseGrosz: number,
  cumulativeBaseBeforeGrosz: number,
  rules: (typeof RYCZALT_RULES)[keyof typeof RYCZALT_RULES],
  jointSpouseThreshold: boolean,
): number {
  const thresholdGrosz = rules.lowerLimitPln * (jointSpouseThreshold ? 2 : 1) * 100;
  const lowerBandGrosz = Math.min(taxableBaseGrosz, Math.max(0, thresholdGrosz - cumulativeBaseBeforeGrosz));
  const upperBandGrosz = taxableBaseGrosz - lowerBandGrosz;
  return roundTaxNumerator(BigInt(lowerBandGrosz) * BigInt(rules.lowerRate) + BigInt(upperBandGrosz) * BigInt(rules.upperRate));
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
  const override = TAX_DEADLINE_OVERRIDES[year]?.[`${mode}:${index}`];
  if (override) return override;
  while (isPolishNonWorkingDay(due)) due.setUTCDate(due.getUTCDate() + 1);
  return due.toISOString().slice(0, 10);
}

/** Exceptional statutory deadline changes can be represented by tax year and period index. */
export const TAX_DEADLINE_OVERRIDES: Readonly<Record<number, Readonly<Record<string, string>>>> = {};

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
