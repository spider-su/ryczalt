import { describe, expect, it } from "vitest";
import { annualRentalThreshold } from "./rentalPresentation";
import { calculateSettlements } from "./ryczaltTax";
import { formatPln } from "./ryczaltTax";
import { formatPolishDate, formatPolishMonth } from "./presentationFormat";
import { currentTaxPeriod, remainingTaxThresholdGrosz, shiftTaxPeriod, shiftTaxPeriodWithinRange, TAX_CALCULATION_EXPLANATION, TAX_TRANSFER_HINT, taxPaymentDisplay, taxPeriodLabel, taxPeriodsForYear, taxRateLabel } from "./taxPresentation";

const income = [{ id: "i", propertyId: "p", receivedAt: "2026-09-01", amount: "17900.00", taxableAmount: "17900.00" }];
function settle(payments: { id: string; period: string; paidAt: string; amount: string }[] = [], today = "2026-09-28") {
  return calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today })[8]!;
}

describe("tax presentation", () => {
  it("shows the authoritative unpaid, partial, paid, zero, and overdue settlement states", () => {
    const due = settle();
    expect(taxPaymentDisplay(due)).toMatchObject({ kind: "due", amountGrosz: due.obligationGrosz, dueDate: due.dueDate });
    expect(taxPaymentDisplay(settle([{ id: "p", period: "2026-09", paidAt: "2026-09-28", amount: "500.00" }]))).toMatchObject({ kind: "partial", paidGrosz: 50_000 });
    expect(taxPaymentDisplay(settle([{ id: "p", period: "2026-09", paidAt: "2026-09-28", amount: "1522.00" }]), "2026-09-28")).toMatchObject({ kind: "paid", paidAt: "2026-09-28", viaCredit: false });
    expect(taxPaymentDisplay(settle([], "2026-11-01"))).toMatchObject({ kind: "overdue" });
    const noTax = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-28" })[8]!;
    expect(taxPaymentDisplay(noTax)).toEqual({ kind: "no-tax" });
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

  it("shows the transfer hint and one compact calculation explanation", () => {
    expect(TAX_TRANSFER_HINT).toBe("PPE · mikrorachunek podatkowy");
    expect(TAX_CALCULATION_EXPLANATION).toContain("potwierdzonych wpływów");
    expect(TAX_CALCULATION_EXPLANATION).toContain("nie uwzględnia indywidualnych odliczeń");
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
