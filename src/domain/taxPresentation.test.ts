import { describe, expect, it } from "vitest";
import { annualRentalThreshold } from "./rentalPresentation";
import { calculateSettlements } from "./ryczaltTax";
import { formatPln } from "./ryczaltTax";
import { formatPolishDate, formatPolishMonth } from "./presentationFormat";
import { currentTaxPeriod, previousOutstandingTax, remainingTaxThresholdGrosz, shiftTaxPeriod, shiftTaxPeriodWithinRange, TAX_CALCULATION_EXPLANATION, TAX_PAYMENT_ALLOCATION_HINT, TAX_TRANSFER_HINT, taxPaymentDisplay, taxPeriodLabel, taxPeriodsForYear, taxRateLabel, taxSummaryForPeriod } from "./taxPresentation";

const income = [{ id: "i", propertyId: "p", receivedAt: "2026-09-01", amount: "17900.00", taxableAmount: "17900.00" }];
function settle(payments: { id: string; period: string; paidAt: string; amount: string }[] = [], today = "2026-09-28") {
  return calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today })[8]!;
}

describe("tax presentation", () => {
  it("shows obligation, allocated payments, and remaining balance for unpaid, partial, paid, and zero-tax periods", () => {
    const due = settle();
    expect(taxPaymentDisplay(due)).toMatchObject({ kind: "due", obligationGrosz: due.obligationGrosz, paidGrosz: 0, remainingGrosz: due.obligationGrosz, dueDate: due.dueDate });
    const partial = taxPaymentDisplay(settle([{ id: "p", period: "2026-09", paidAt: "2026-09-28", amount: "500.00" }]));
    expect(partial).toMatchObject({ kind: "partial", paidGrosz: 50_000, remainingGrosz: due.obligationGrosz - 50_000 });
    const paid = taxPaymentDisplay(settle([{ id: "p", period: "2026-09", paidAt: "2026-09-28", amount: "1522.00" }]));
    expect(paid).toMatchObject({ kind: "paid", obligationGrosz: due.obligationGrosz, paidGrosz: due.obligationGrosz, remainingGrosz: 0, viaCredit: false });
    expect(taxPaymentDisplay(settle([], "2026-11-01"))).toMatchObject({ kind: "overdue" });
    const noTax = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-28" })[8]!;
    expect(taxPaymentDisplay(noTax)).toMatchObject({ kind: "no-tax", obligationGrosz: 0, paidGrosz: 0, remainingGrosz: 0 });
  });

  it("does not present a payment recorded in the current period as current-period tax when it paid older debt", () => {
    const settlements = calculateSettlements({
      entries: [
        { id: "jan", propertyId: "p", receivedAt: "2026-01-01", amount: "1000.00", taxableAmount: "1000.00" },
        { id: "feb", propertyId: "p", receivedAt: "2026-02-01", amount: "1000.00", taxableAmount: "1000.00" },
      ],
      payments: [{ id: "feb-payment", period: "2026-02", paidAt: "2026-03-10", amount: "85.00" }],
      taxYear: 2026, mode: "monthly", today: "2026-03-15",
    });
    expect(settlements[0]).toMatchObject({ allocatedPaidGrosz: 8_500, outstandingGrosz: 0 });
    expect(settlements[1]).toMatchObject({ paidGrosz: 8_500, allocatedPaidGrosz: 0, outstandingGrosz: 8_500 });
    expect(taxPaymentDisplay(settlements[1]!)).toMatchObject({ kind: "due", paidGrosz: 0, remainingGrosz: 8_500 });
  });

  it("summarizes several older outstanding periods without adding them to the current obligation", () => {
    const settlements = calculateSettlements({
      entries: ["2026-01", "2026-02", "2026-09"].map((month, index) => ({
        id: `i${index}`, propertyId: "p", receivedAt: `${month}-01`, amount: "1000.00", taxableAmount: "1000.00",
      })),
      payments: [], taxYear: 2026, mode: "monthly", today: "2026-10-01",
    });
    const current = settlements[8]!;
    const older = previousOutstandingTax(settlements, current.period);
    expect(older).toEqual({ count: 2, totalGrosz: 17_000 });
    expect(current.obligationGrosz).toBe(8_500);
    expect(taxPaymentDisplay(current).remainingGrosz).toBe(8_500);
  });

  it("projects current and earlier tax separately for the Pulpit summary", () => {
    const incomeFor = (months: string[]) => months.map((month, index) => ({
      id: `pulpit-${index}`, propertyId: "p", receivedAt: `${month}-01`, amount: "1000.00", taxableAmount: "1000.00",
    }));
    const project = (months: string[], payments: { id: string; period: string; paidAt: string; amount: string }[] = []) => {
      const settlements = calculateSettlements({ entries: incomeFor(months), payments, taxYear: 2026, mode: "monthly", today: "2026-10-01" });
      return taxSummaryForPeriod(settlements, "2026-09");
    };

    const noHistory = project(["2026-09"]);
    expect(noHistory.current).toMatchObject({ obligationGrosz: 8_500, status: "due", dueDate: "2026-10-20" });
    expect(noHistory.previousOutstanding).toEqual({ count: 0, totalGrosz: 0 });

    const oneEarlier = project(["2026-01", "2026-09"]);
    expect(oneEarlier.current?.obligationGrosz).toBe(8_500);
    expect(oneEarlier.previousOutstanding).toEqual({ count: 1, totalGrosz: 8_500 });

    const severalEarlier = project(["2026-01", "2026-02", "2026-09"]);
    expect(severalEarlier.current?.obligationGrosz).toBe(8_500);
    expect(severalEarlier.previousOutstanding).toEqual({ count: 2, totalGrosz: 17_000 });

    const paidCurrent = project(["2026-09"], [{ id: "sep-paid", period: "2026-09", paidAt: "2026-10-10", amount: "85.00" }]);
    expect(paidCurrent.current).toMatchObject({ obligationGrosz: 8_500, outstandingGrosz: 0, status: "paid", dueDate: "2026-10-20" });

    const noCurrentTax = project(["2026-01"]);
    expect(noCurrentTax.current).toMatchObject({ obligationGrosz: 0, status: "no-tax" });
    expect(noCurrentTax.previousOutstanding).toEqual({ count: 1, totalGrosz: 8_500 });
  });

  it("navigates localized months and periods across year boundaries", () => {
    expect(shiftTaxPeriod("2026-12", 1, "monthly")).toBe("2027-01");
    expect(shiftTaxPeriod("2027-01", -1, "monthly")).toBe("2026-12");
    expect(taxPeriodLabel("2026-09", "monthly")).toBe(formatPolishMonth("2026-09"));
    expect(shiftTaxPeriod("2026-Q4", 1, "quarterly")).toBe("2027-Q1");
    expect(shiftTaxPeriod("2027-Q1", -1, "quarterly")).toBe("2026-Q4");
  });

  it("limits manual period navigation to tracked months through the current period", () => {
    const now = new Date(2026, 8, 28, 12);
    expect(currentTaxPeriod(now)).toBe("2026-09");
    expect(shiftTaxPeriodWithinRange("2026-09", 1, "monthly", now, "2026-03")).toBe("2026-09");
    expect(shiftTaxPeriodWithinRange("2026-08", 1, "monthly", now, "2026-03")).toBe("2026-09");
    expect(taxPeriodsForYear(2026, "monthly", now, "2026-03")).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(taxPeriodsForYear(2025, "monthly", now)).toHaveLength(12);
    expect(taxPeriodsForYear(2025, "monthly", now).at(-1)).toBe("2025-12");
    expect(taxPeriodsForYear(2027, "monthly", now)).toEqual([]);
    expect(taxPeriodsForYear(2026, "quarterly", now).at(-1)).toBe("2026-Q3");
  });

  it("does not offer empty historical periods when tracking starts this year", () => {
    const now = new Date(2026, 8, 28, 12);
    const earliestTrackedPeriod = "2026-01";
    expect(taxPeriodsForYear(2025, "monthly", now, earliestTrackedPeriod)).toEqual([]);
    expect(shiftTaxPeriodWithinRange("2026-01", -1, "monthly", now, earliestTrackedPeriod)).toBe("2026-01");
  });

  it("shows the transfer hint and one compact calculation explanation", () => {
    expect(TAX_TRANSFER_HINT).toBe("PPE · mikrorachunek podatkowy");
    expect(TAX_CALCULATION_EXPLANATION).toContain("potwierdzonych wpływów");
    expect(TAX_CALCULATION_EXPLANATION).toContain("nie uwzględnia indywidualnych odliczeń");
    expect(TAX_PAYMENT_ALLOCATION_HINT).toContain("najstarszej nierozliczonej należności");
  });

  it("calculates remaining progress against the active single or spouse threshold", () => {
    expect(remainingTaxThresholdGrosz(4_260_000, annualRentalThreshold(2026))).toBe(5_740_000);
    expect(remainingTaxThresholdGrosz(4_260_000, annualRentalThreshold(2026, true))).toBe(15_740_000);
    expect(remainingTaxThresholdGrosz(21_000_000, annualRentalThreshold(2026, true))).toBe(0);
  });

  it("uses the same configured rate band and capped progress threshold as Pulpit", () => {
    for (const joint of [false, true]) {
      const threshold = annualRentalThreshold(2026, joint);
      expect(threshold).toBe(joint ? 20_000_000 : 10_000_000);
      expect(taxRateLabel(threshold, threshold)).toBe("8,5%");
      expect(taxRateLabel(threshold + 1, threshold)).toBe("8,5% / 12,5%");
    }
  });

  it("keeps Polish amount and date formatting", () => {
    expect(formatPln(152_200)).toBe("1 522,00 zł");
    expect(formatPolishDate("2026-10-20", "long")).toBe("20 października 2026");
  });
});
