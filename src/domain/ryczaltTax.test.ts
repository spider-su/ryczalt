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
    expect(calculateSettlements({ entries: income, payments: partial, taxYear: 2026, mode: "monthly" })[0]).toMatchObject({ status: "partial", outstandingGrosz: 5_500 });
    expect(calculateSettlements({ entries: income, payments: [{ ...partial[0]!, amount: "85.00" }], taxYear: 2026, mode: "monthly" })[0]).toMatchObject({ status: "paid", outstandingGrosz: 0 });
    expect(calculateSettlements({ entries: income, payments: [], taxYear: 2026, mode: "monthly", today: "2026-02-15" })[0]).toMatchObject({ status: "due", paidGrosz: 0 });
  });

  it("handles zero revenue, rounding, and Polish non-working-day deadlines", () => {
    const zero = calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly", today: "2026-01-01" })[0]!;
    expect(zero.status).toBe("no-tax");
    expect(zero.dueDate).toBe("2026-02-20");
    expect(calculateSettlements({ entries: [], payments: [], taxYear: 2026, mode: "monthly" })[10]?.dueDate).toBe("2026-12-21");
    expect(moneyToGrosz("0.05")).toBe(5);
    expect(formatPln(1_000_050)).toBe("10 000,50 zł");
  });

  it("rounds each monthly obligation to whole PLN after applying both rate bands", () => {
    const tinyReceipts = Array.from({ length: 12 }, (_, month) =>
      entry(`income-${month}`, `2026-${String(month + 1).padStart(2, "0")}-10`, "1.00"),
    );
    const settlements = calculateSettlements({ entries: tinyReceipts, payments: [], taxYear: 2026, mode: "monthly" });
    expect(settlements.every((item) => item.obligationGrosz === 0)).toBe(true);
    expect(taxOnRevenue(1_200, 2026)).toBe(100);
  });

  it("recalculates later threshold bands after an earlier receipt is corrected", () => {
    const payments: TaxPayment[] = [{ id: "tax-1", period: "2026-02", paidAt: "2026-03-10", amount: "1000.00" }];
    const beforeCorrection = calculateSettlements({ entries: [
      entry("income-1", "2026-01-05", "30000.00"),
      entry("income-2", "2026-02-05", "70000.00"),
    ], payments, taxYear: 2026, mode: "monthly" });
    const corrected = calculateSettlements({ entries: [
      entry("income-1", "2026-01-05", "40000.00"),
      entry("income-2", "2026-02-05", "70000.00"),
    ], payments, taxYear: 2026, mode: "monthly" });
    expect(beforeCorrection[1]?.obligationGrosz).toBe(595_000);
    expect(corrected[1]).toMatchObject({ obligationGrosz: 635_000, paidGrosz: 100_000, outstandingGrosz: 535_000 });
  });
});
