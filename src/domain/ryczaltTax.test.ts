import { describe, expect, it } from "vitest";
import type { IncomeEntry, TaxPayment } from "../model/rental";
import { calculateSettlements, formatPln, moneyToGrosz, taxOnRevenue } from "./ryczaltTax";

const entry = (id: string, receivedAt: string, taxableAmount: string, propertyId = "property-1"): IncomeEntry => ({
  id, propertyId, receivedAt, amount: taxableAmount, taxableAmount,
});

describe("Polish private-rental ryczałt", () => {
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
    expect(paid).toMatchObject({ obligationGrosz: 8_500, paidGrosz: 10_000, outstandingGrosz: 0, overpaidGrosz: 1_500, status: "paid" });
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
    const calculate = (payments: TaxPayment[]) => calculateSettlements({ entries: income, payments, taxYear: 2026, mode: "monthly", today: "2026-06-01" });
    const exact = calculate([{ id: "jan-exact", period: "2026-01", paidAt: "2026-02-10", amount: "85.00" }]);
    expect(exact[0]).toMatchObject({ obligationGrosz: 8_500, paidGrosz: 8_500, outstandingGrosz: 0, overpaidGrosz: 0 });

    const underpaid = calculate([{ id: "jan-under", period: "2026-01", paidAt: "2026-02-10", amount: "50.00" }]);
    expect(underpaid[0]).toMatchObject({ outstandingGrosz: 3_500, status: "partial" });
    expect(underpaid[1]).toMatchObject({ outstandingGrosz: 8_500 });

    const overpaid = calculate([{ id: "jan-over", period: "2026-01", paidAt: "2026-02-10", amount: "100.00" }]);
    expect(overpaid[0]).toMatchObject({ overpaidGrosz: 1_500, outstandingGrosz: 0 });
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
    expect(settlements[1]).toMatchObject({ obligationGrosz: 89_400, paidGrosz: 58_000, creditAppliedGrosz: 31_400, outstandingGrosz: 0 });
  });

  it("handles zero revenue, rounding, and Polish non-working-day deadlines", () => {
    const zero = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" })[0]!;
    expect(zero.status).toBe("no-tax");
    expect(zero.dueDate).toBe("2026-02-20");
    expect(calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" })[10]?.dueDate).toBe("2026-12-21");
    expect(moneyToGrosz("0.05")).toBe(5);
    expect(formatPln(1_000_050)).toBe("10 000,50 zł");
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
