import { describe, expect, it } from "vitest";
import type { IncomeEntry, TaxPayment } from "../model/rental";
import { calculateSettlements, calculateTaxYear, formatPln, formatPlnAmount, hasTaxRulesForYear, moneyToGrosz, roundTaxBaseGrosz, settlementPeriodForMonth, taxNavigationYears, taxOnRevenue, todayInPoland } from "./ryczaltTax";
import { taxPeriodsForYear } from "./taxPresentation";

const entry = (id: string, receivedAt: string, taxableAmount: string, propertyId = "property-1"): IncomeEntry => ({
  id, propertyId, receivedAt, amount: taxableAmount, taxableAmount,
});

describe("Polish private-rental ryczałt", () => {
  it("resolves monthly and quarterly settlement periods from the calendar month", () => {
    expect(settlementPeriodForMonth("2026-09", "monthly")).toBe("2026-09");
    expect(settlementPeriodForMonth("2026-01", "quarterly")).toBe("2026-Q1");
    expect(settlementPeriodForMonth("2026-05", "quarterly")).toBe("2026-Q2");
    expect(settlementPeriodForMonth("2026-08", "quarterly")).toBe("2026-Q3");
    expect(settlementPeriodForMonth("2026-12", "quarterly")).toBe("2026-Q4");
    expect(settlementPeriodForMonth("2026-13", "quarterly")).toBeNull();
  });

  it("rounds each period's taxable base to whole PLN before tax", () => {
    expect(roundTaxBaseGrosz(1_234_49)).toBe(1_234_00);
    expect(roundTaxBaseGrosz(1_234_50)).toBe(1_235_00);
    expect(roundTaxBaseGrosz(1_234_00)).toBe(1_234_00);
    const settlements = calculateSettlements({ entries: [
      entry("base-down", "2026-01-01", "1234.49"),
      entry("base-up", "2026-02-01", "1234.50"),
      entry("base-exact", "2026-03-01", "1234.00"),
    ], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" });
    expect(settlements.slice(0, 3).map(({ taxableBaseGrosz }) => taxableBaseGrosz)).toEqual([123_400, 123_500, 123_400]);
  });

  it("rounds the base before splitting across the 100k and spouse 200k thresholds", () => {
    const one = (amount: string, jointSpouseThreshold = false) => calculateSettlements({
      entries: [entry("threshold", "2026-01-01", amount)], payments: [], taxYear: 2026, mode: "monthly", jointSpouseThreshold, today: "2026-01-01",
    })[0]!;
    expect(one("100000.49")).toMatchObject({ taxableBaseGrosz: 10_000_000, obligationGrosz: 850_000 });
    expect(one("100004.50")).toMatchObject({ taxableBaseGrosz: 10_000_500, obligationGrosz: 850_100 });
    expect(one("200000.49", true)).toMatchObject({ taxableBaseGrosz: 20_000_000, obligationGrosz: 1_700_000 });
    expect(one("200004.50", true)).toMatchObject({ taxableBaseGrosz: 20_000_500, obligationGrosz: 1_700_100 });
    expect(one("200000.00")).toMatchObject({ obligationGrosz: 2_100_000 });
  });

  it("uses the same band calculation for annual tax and cumulative period settlements", () => {
    const entries = [
      entry("jan", "2026-01-10", "40000.00"),
      entry("feb", "2026-02-10", "60000.00"),
      entry("mar", "2026-03-10", "10000.00"),
    ];
    const settlements = calculateSettlements({ entries, payments: [], taxYear: 2026, mode: "monthly", today: "2026-03-01" });
    expect(settlements.reduce((total, item) => total + item.obligationGrosz, 0)).toBe(taxOnRevenue(11_000_000, 2026));
    expect(settlements[2]?.obligationGrosz).toBe(125_000);
  });

  it("keeps opening tax as an aggregate balance and never attributes it to January", () => {
    const receivedLater = [entry("later", "2026-09-10", "4600.00")];
    const settledOpening = calculateTaxYear({ entries: receivedLater, payments: [], taxYear: 2026, mode: "monthly",
      openingTaxableRevenueGrosz: 2_160_000, openingTaxPaidGrosz: 183_600, today: "2026-09-28" });
    expect(settledOpening.openingBalance).toEqual({ taxableRevenueGrosz: 2_160_000, calculatedTaxGrosz: 183_600, paidTaxGrosz: 183_600, outstandingGrosz: 0, overpaidGrosz: 0 });
    expect(settledOpening.settlements[8]).toMatchObject({ revenueGrosz: 460_000, cumulativeRevenueGrosz: 2_620_000, obligationGrosz: 39_100, outstandingGrosz: 39_100 });
    const unpaidOpening = calculateTaxYear({ entries: receivedLater, payments: [], taxYear: 2026, mode: "monthly",
      openingTaxableRevenueGrosz: 2_160_000, openingTaxPaidGrosz: 100_000, today: "2026-09-28" });
    expect(unpaidOpening.openingBalance).toMatchObject({ calculatedTaxGrosz: 183_600, paidTaxGrosz: 100_000, outstandingGrosz: 83_600, overpaidGrosz: 0 });
    expect(unpaidOpening.settlements[0]).toMatchObject({ obligationGrosz: 0, outstandingGrosz: 0, status: "no-tax" });
    expect(unpaidOpening.settlements[8]?.obligationGrosz).toBe(39_100);
    expect(unpaidOpening.settlements[8]?.cumulativeTaxGrosz).toBe(222_700);
    expect(unpaidOpening.settlements[8]?.status).toBe("due");
    const overpaidOpening = calculateTaxYear({ entries: [], payments: [], taxYear: 2026, mode: "monthly",
      openingTaxableRevenueGrosz: 2_160_000, openingTaxPaidGrosz: 200_000, today: "2026-09-28" });
    expect(overpaidOpening.openingBalance).toMatchObject({ outstandingGrosz: 0, overpaidGrosz: 16_400 });
    expect(overpaidOpening.settlements[0]?.creditAppliedGrosz).toBe(0);
    expect(receivedLater).toHaveLength(1);
  });

  it("rounds tax amounts to whole PLN after calculating the rate", () => {
    expect(taxOnRevenue(10_000, 2026)).toBe(900); // PLN 8.50 -> PLN 9
    expect(taxOnRevenue(6_00, 2026)).toBe(100); // PLN 0.51 -> PLN 1
    expect(taxOnRevenue(5_00, 2026)).toBe(0); // PLN 0.425 -> PLN 0
  });

  it("uses Europe/Warsaw for the default tax-status date across timezone and DST boundaries", () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Honolulu";
      expect(todayInPoland(new Date("2026-02-20T23:30:00.000Z"))).toBe("2026-02-21");
      expect(todayInPoland(new Date("2026-03-29T00:30:00.000Z"))).toBe("2026-03-29");
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it("marks partial obligations overdue after the deadline and keeps paid obligations paid", () => {
    const income = [entry("jan", "2026-01-01", "1000.00")];
    const payment: TaxPayment = { id: "partial", period: "2026-01", paidAt: "2026-02-10", amount: "30.00" };
    const status = (payments: TaxPayment[], today: string) => calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today })[0]!.status;
    expect(status([], "2026-02-19")).toBe("due");
    expect(status([payment], "2026-02-19")).toBe("partial");
    expect(status([payment], "2026-02-21")).toBe("overdue");
    expect(status([], "2026-02-21")).toBe("overdue");
    expect(status([{ ...payment, amount: "85.00" }], "2026-02-21")).toBe("paid");
  });

  it("keeps December and Q4 periodic payments due in January", () => {
    const monthly = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-12-01" });
    const quarterly = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "quarterly", today: "2026-12-01" });
    expect(monthly[9]?.dueDate).toBe("2026-11-20");
    expect(monthly[10]?.dueDate).toBe("2026-12-21"); // Sunday 20 December moves to Monday.
    expect(monthly[11]?.dueDate).toBe("2027-01-20");
    expect(quarterly[2]?.dueDate).toBe("2026-10-20");
    expect(quarterly[3]?.dueDate).toBe("2027-01-20");
    expect(calculateSettlements({ entries: [], payments: [], taxYear: 2025, mode: "quarterly", today: "2025-12-01" })[3]?.dueDate).toBe("2026-01-20");
  });

  it("keeps 2027 calendar navigation available without reusing unsupported tax rules", () => {
    const jan2027 = new Date(2027, 0, 1, 12);
    expect(taxNavigationYears(jan2027)).toEqual([2025, 2026, 2027]);
    expect(hasTaxRulesForYear(2027)).toBe(false);
    expect(taxPeriodsForYear(2027, "monthly", jan2027)).toEqual(["2027-01"]);
    expect(taxPeriodsForYear(2027, "monthly", jan2027, "2027-01")).toEqual(["2027-01"]);
    expect(() => calculateSettlements({ entries: [], payments: [], taxYear: 2027, mode: "monthly", today: "2027-01-01" })).toThrow("not available");
  });

  it("uses year-specific 8.5% and 12.5% bands with whole-zloty rounding", () => {
    expect(taxOnRevenue(50_000_00, 2026)).toBe(425_000);
    expect(taxOnRevenue(100_000_00, 2026)).toBe(850_000);
    expect(taxOnRevenue(110_000_00, 2026)).toBe(975_000);
    expect(taxOnRevenue(110_000_00, 2026, true)).toBe(935_000);
    expect(taxOnRevenue(10_000, 2025)).toBe(900); // PLN 8.50 rounds upward to PLN 9
    expect(taxOnRevenue(200_000_00, 2026, true)).toBe(1_700_000);
    expect(() => calculateSettlements({ entries: [], payments: [], taxYear: 2027, mode: "monthly", today: "2027-01-01" })).toThrow("not available");
    expect(() => taxOnRevenue(100, 2027)).toThrow("not available");
  });

  it("aggregates apartments and partial receipts by actual receipt month", () => {
    const settlements = calculateSettlements({ entries: [
      entry("income-1", "2026-01-12", "3000.00"),
      entry("income-2", "2026-01-30", "500.00", "property-2"),
      entry("income-3", "2026-02-01", "2500.00"),
      entry("income-4", "2025-12-31", "9000.00"),
    ], payments: [], taxYear: 2026, mode: "monthly", today: "2026-02-10" });
    expect(settlements[0]).toMatchObject({ revenueGrosz: 350_000, cumulativeRevenueGrosz: 350_000, obligationGrosz: 29_800 });
    expect(settlements[1]).toMatchObject({ revenueGrosz: 250_000, cumulativeRevenueGrosz: 600_000, obligationGrosz: 21_300 });
    expect(settlements[11]?.revenueGrosz).toBe(0);
  });

  it("splits the threshold over periods and calculates quarterly obligations", () => {
    const quarterly = calculateSettlements({ entries: [
      entry("income-1", "2026-03-31", "50000.00"),
      entry("income-2", "2026-04-01", "60000.00"),
    ], payments: [], taxYear: 2026, mode: "quarterly", today: "2026-06-30" });
    expect(quarterly[0]).toMatchObject({ revenueGrosz: 5_000_000, obligationGrosz: 425_000, dueDate: "2026-04-20" });
    expect(quarterly[1]).toMatchObject({ cumulativeRevenueGrosz: 11_000_000, obligationGrosz: 550_000, cumulativeTaxGrosz: 975_000 });
  });

  it("tracks missing, partial, full, multiple and excess payments without changing liability", () => {
    const income = [entry("income-1", "2026-01-02", "1000.00")];
    const payments: TaxPayment[] = [
      { id: "tax-1", period: "2026-01", paidAt: "2026-02-10", amount: "50.00" },
      { id: "tax-2", period: "2026-01", paidAt: "2026-02-11", amount: "50.00" },
    ];
    const paid = calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today: "2026-02-15" })[0]!;
    expect(paid).toMatchObject({ obligationGrosz: 8_500, allocatedPaidGrosz: 8_500, paidGrosz: 10_000, outstandingGrosz: 0, overpaidGrosz: 1_500, status: "paid" });
    const overdue = calculateSettlements({ entries: income, payments: [], taxYear: 2026, mode: "monthly", today: "2026-02-21" })[0]!;
    expect(overdue.status).toBe("overdue");
    expect(overdue.obligationGrosz).toBe(paid.obligationGrosz);
    const partial: TaxPayment[] = [{ id: "tax-partial", period: "2026-01", paidAt: "2026-02-10", amount: "30.00" }];
    expect(calculateSettlements({ entries: income, payments: partial, taxYear: 2026, mode: "monthly", today: "2026-02-15" })[0]).toMatchObject({ status: "partial", outstandingGrosz: 5_500 });
    expect(calculateSettlements({ entries: income, payments: [{ ...partial[0]!, amount: "85.00" }], taxYear: 2026, mode: "monthly", today: "2026-02-15" })[0]).toMatchObject({ status: "paid", outstandingGrosz: 0 });
    expect(calculateSettlements({ entries: income, payments: [], taxYear: 2026, mode: "monthly", today: "2026-02-15" })[0]).toMatchObject({ status: "due", paidGrosz: 0 });
  });

  it("carries confirmed tax credits forward and recalculates later periods after payment changes", () => {
    const income = [
      entry("jan", "2026-01-02", "1000.00"),
      entry("feb", "2026-02-02", "1000.00"),
      entry("mar", "2026-03-02", "1000.00"),
      entry("apr", "2026-04-02", "1000.00"),
      entry("may", "2026-05-02", "1000.00"),
    ];
    const calculate = (payments: TaxPayment[]) => calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today: "2026-02-15" });
    const exact = calculate([{ id: "jan-exact", period: "2026-01", paidAt: "2026-02-10", amount: "85.00" }]);
    expect(exact[0]).toMatchObject({ obligationGrosz: 8_500, allocatedPaidGrosz: 8_500, paidGrosz: 8_500, outstandingGrosz: 0, overpaidGrosz: 0 });

    const underpaid = calculate([{ id: "jan-under", period: "2026-01", paidAt: "2026-02-10", amount: "50.00" }]);
    expect(underpaid[0]).toMatchObject({ allocatedPaidGrosz: 5_000, outstandingGrosz: 3_500, status: "partial" });
    expect(underpaid[1]).toMatchObject({ outstandingGrosz: 8_500 });

    const overpaid = calculate([{ id: "jan-over", period: "2026-01", paidAt: "2026-02-10", amount: "100.00" }]);
    expect(overpaid[0]).toMatchObject({ allocatedPaidGrosz: 8_500, overpaidGrosz: 1_500, outstandingGrosz: 0 });
    expect(overpaid[1]).toMatchObject({ obligationGrosz: 8_500, outstandingGrosz: 7_000 });

    const spanningCredit = calculate([{ id: "jan-large-over", period: "2026-01", paidAt: "2026-02-10", amount: "400.00" }]);
    expect(spanningCredit.slice(0, 4).map((item) => item.outstandingGrosz)).toEqual([0, 0, 0, 0]);
    expect(spanningCredit[4]).toMatchObject({ outstandingGrosz: 2_500 });

    const removed = calculate([]);
    const corrected = calculate([{ id: "jan-corrected", period: "2026-01", paidAt: "2026-02-10", amount: "50.00" }]);
    expect(removed[1]?.outstandingGrosz).toBe(8_500);
    expect(corrected[1]?.outstandingGrosz).toBe(8_500);
    expect(corrected[0]?.outstandingGrosz).toBe(3_500);
    expect(income[0]?.amount).toBe("1000.00");

    const overpaymentBeforeEdit = calculate([{ id: "jan-edited", period: "2026-01", paidAt: "2026-02-10", amount: "130.00" }]);
    const overpaymentAfterEdit = calculate([{ id: "jan-edited", period: "2026-01", paidAt: "2026-02-10", amount: "100.00" }]);
    expect(overpaymentBeforeEdit[1]?.outstandingGrosz).toBe(4_000);
    expect(overpaymentAfterEdit[1]?.outstandingGrosz).toBe(7_000);
  });

  it("exposes prior overpayment applied alongside the current period payment", () => {
    const settlements = calculateSettlements({
      entries: [entry("jan", "2026-01-02", "1000.00"), entry("feb", "2026-02-02", "10517.65")],
      payments: [
        { id: "jan-overpaid", period: "2026-01", paidAt: "2026-02-10", amount: "399.00" },
        { id: "feb-payment", period: "2026-02", paidAt: "2026-03-10", amount: "580.00" },
      ],
      taxYear: 2026, mode: "monthly", today: "2026-03-15",
    });
    expect(settlements[1]).toMatchObject({ obligationGrosz: 89_400, allocatedPaidGrosz: 89_400, paidGrosz: 58_000, creditAppliedGrosz: 31_400, outstandingGrosz: 0 });
  });

  it("handles zero revenue, rounding, and Polish non-working-day deadlines", () => {
    const zero = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" })[0]!;
    expect(zero.status).toBe("no-tax");
    expect(zero.dueDate).toBe("2026-02-20");
    expect(calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" })[10]?.dueDate).toBe("2026-12-21");
    expect(moneyToGrosz("0.05")).toBe(5);
    expect(formatPln(1_000_050)).toBe("10 000,50 zł");
    expect(formatPln(0)).toBe("0,00 zł");
    expect(formatPln(-12_345)).toBe("-123,45 zł");
    expect(formatPln(123_456_789)).toBe("1 234 567,89 zł");
    expect(formatPlnAmount("3000")).toBe("3 000,00 zł");
    expect(formatPlnAmount("2500.50")).toBe("2 500,50 zł");
  });

  it("moves a deadline past Easter Monday and rejects invalid or unsafe money", () => {
    const march2025 = calculateSettlements({
      entries: [entry("income-easter", "2025-03-01", "100.00")],
      payments: [], taxYear: 2025, mode: "monthly", today: "2025-04-01",
    })[2]!;
    expect(march2025.dueDate).toBe("2025-04-22");
    expect(() => moneyToGrosz("01.00")).toThrow("Invalid PLN amount");
    expect(() => moneyToGrosz("1.001")).toThrow("Invalid PLN amount");
    expect(() => moneyToGrosz("90071992547409.92")).toThrow("too large");
  });

  it("rounds each monthly obligation to whole PLN after applying both rate bands", () => {
    const tinyReceipts = Array.from({ length: 12 }, (_, month) =>
      entry(`income-${month}`, `2026-${String(month + 1).padStart(2, "0")}-10`, "1.00"),
    );
    const settlements = calculateSettlements({ entries: tinyReceipts, payments: [], taxYear: 2026, mode: "monthly", today: "2026-12-01" });
    expect(settlements.every((item) => item.obligationGrosz === 0)).toBe(true);
    expect(taxOnRevenue(1_200, 2026)).toBe(100);
  });

  it("recalculates later threshold bands after an earlier receipt is corrected", () => {
    const payments: TaxPayment[] = [{ id: "tax-1", period: "2026-02", paidAt: "2026-03-10", amount: "1000.00" }];
    const beforeCorrection = calculateSettlements({ entries: [
      entry("income-1", "2026-01-05", "30000.00"),
      entry("income-2", "2026-02-05", "70000.00"),
    ], payments, taxYear: 2026, mode: "monthly", today: "2026-03-01" });
    const corrected = calculateSettlements({ entries: [
      entry("income-1", "2026-01-05", "40000.00"),
      entry("income-2", "2026-02-05", "70000.00"),
    ], payments, taxYear: 2026, mode: "monthly", today: "2026-03-01" });
    expect(beforeCorrection[1]?.obligationGrosz).toBe(595_000);
    expect(corrected[0]).toMatchObject({ outstandingGrosz: 240_000 });
    expect(corrected[1]).toMatchObject({ obligationGrosz: 635_000, paidGrosz: 100_000, outstandingGrosz: 635_000 });

  });
});
