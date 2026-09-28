import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { groupIncomeEntriesByReceivedMonth, historicalIncomeGroups, incomeEntriesForView, incomeMonthStatus, incomeRangeSummary, incomeTimeWindow, incomeViewSummary, propertiesWithIncomeInYear, rentMonthStatusRows, toggleIncomeMonth } from "./incomeHistory";

const entry = (id: string, propertyId: string, receivedAt: string, amount: string, tenantNameSnapshot?: string): IncomeEntry => ({
  id, propertyId, receivedAt, amount, taxableAmount: amount, rentalMonth: "2026-09", tenantNameSnapshot,
});

describe("income history view", () => {
  const records = [
    entry("first", "flat-a", "2026-09-28", "2600", "Anna Nowak"),
    entry("second", "flat-a", "2026-09-28", "1010", "Anna Kipricz"),
    entry("older", "flat-b", "2026-09-02", "3900", "Illya Mukasei"),
    entry("august", "flat-a", "2026-08-30", "1200"),
    entry("prior-year", "flat-a", "2025-12-30", "700"),
  ];

  it("filters the selected year and apartment for matching annual total and payment count", () => {
    const filtered = incomeEntriesForView(records, 2026, "flat-a");
    expect(filtered.map(({ id }) => id)).toEqual(["first", "second", "august"]);
    expect(incomeViewSummary(filtered)).toEqual({ totalGrosz: 481_000, count: 3, propertyCount: 1 });
  });

  it("keeps archived apartments with historical income available in the filter", () => {
    const properties: Property[] = [
      { id: "flat-a", address: "Aktywne" },
      { id: "flat-b", address: "Archiwalne", lifecycle: "ARCHIVED" },
      { id: "empty", address: "Bez wpłat", lifecycle: "ARCHIVED" },
    ];
    expect(propertiesWithIncomeInYear(properties, records, 2026).map(({ address }) => address)).toEqual(["Aktywne", "Archiwalne"]);
  });

  it("includes all apartments and returns a real zero for an empty selection", () => {
    expect(incomeViewSummary(incomeEntriesForView(records, 2026, null))).toEqual({ totalGrosz: 871_000, count: 4, propertyCount: 2 });
    expect(incomeViewSummary(incomeEntriesForView(records, 2024, "flat-a"))).toEqual({ totalGrosz: 0, count: 0, propertyCount: 0 });
  });

  it("uses taxable owner income for the annual total while keeping payment and apartment counts", () => {
    const nonTaxableMedia = { ...records[0]!, amount: "3000.00", taxableAmount: "2500.00" };
    expect(incomeViewSummary([nonTaxableMedia])).toEqual({ totalGrosz: 250_000, count: 1, propertyCount: 1 });
  });

  it("groups by received month, sums actual cash, sorts newest first, and preserves split payments and tenant snapshots", () => {
    const groups = groupIncomeEntriesByReceivedMonth(records);
    expect(groups.map(({ month, totalGrosz }) => [month, totalGrosz])).toEqual([
      ["2026-09", 751_000], ["2026-08", 120_000], ["2025-12", 70_000],
    ]);
    expect(groups[0]?.entries.map(({ id }) => id)).toEqual(["first", "second", "older"]);
    expect(groups[0]?.entries.slice(0, 2).map(({ tenantNameSnapshot }) => tenantNameSnapshot)).toEqual(["Anna Nowak", "Anna Kipricz"]);
  });

  it("recalculates summary and month totals after edits and deletes", () => {
    const edited = records.map((item) => item.id === "second" ? { ...item, amount: "900" } : item);
    const afterEdit = groupIncomeEntriesByReceivedMonth(incomeEntriesForView(edited, 2026, null));
    expect(afterEdit[0]?.totalGrosz).toBe(740_000);
    const afterDelete = groupIncomeEntriesByReceivedMonth(incomeEntriesForView(edited.filter((item) => item.id !== "first"), 2026, null));
    expect(incomeViewSummary(incomeEntriesForView(edited.filter((item) => item.id !== "first"), 2026, null))).toEqual({ totalGrosz: 611_000, count: 3, propertyCount: 2 });
    expect(afterDelete[0]?.totalGrosz).toBe(480_000);
  });

  it("toggles month sections in memory", () => {
    expect(toggleIncomeMonth(["2026-09"], "2026-09")).toEqual([]);
    expect(toggleIncomeMonth([], "2026-08")).toEqual(["2026-08"]);
  });

  it("presents complete and incomplete groups with their monthly totals and payment counts", () => {
    const september = groupIncomeEntriesByReceivedMonth(records)[0]!;
    expect(september.totalGrosz).toBe(751_000);
    expect(incomeMonthStatus(september.totalGrosz, september.entries.length, 800_000)).toEqual({ completion: "incomplete", paymentLabel: "3 wpłaty" });
    expect(incomeMonthStatus(553_400, 2, 553_400)).toEqual({ completion: "complete", paymentLabel: "2 wpłaty" });
    expect(incomeMonthStatus(553_400, 2, null).completion).toBe("unknown");
  });

  it("compresses January through August into an actual payments-only summary", () => {
    const entries = Array.from({ length: 8 }, (_, index) => [
      entry(`a-${index}`, "flat-a", `2026-${String(index + 1).padStart(2, "0")}-05`, "2767"),
      entry(`b-${index}`, "flat-b", `2026-${String(index + 1).padStart(2, "0")}-20`, "2767"),
    ]).flat();
    const history = historicalIncomeGroups(groupIncomeEntriesByReceivedMonth(entries), "2026-09");
    const summary = incomeRangeSummary(history);
    expect(summary).toEqual({ earliestMonth: "2026-01", latestMonth: "2026-08", monthCount: 8, totalGrosz: 4_427_200, paymentCount: 16 });
    expect(summary?.totalGrosz).toBe(history.flatMap(({ entries: monthEntries }) => monthEntries).reduce((total, item) => total + Number(item.amount) * 100, 0));
    expect(summary?.paymentCount).toBe(history.flatMap(({ entries: monthEntries }) => monthEntries).length);
  });

  it("keeps one historical month direct and returns no range when there is no earlier history", () => {
    const groups = groupIncomeEntriesByReceivedMonth([entry("august", "flat-a", "2026-08-30", "1200")]);
    expect(historicalIncomeGroups(groups, "2026-09")).toHaveLength(1);
    expect(incomeRangeSummary(historicalIncomeGroups(groups, "2026-09"))?.monthCount).toBe(1);
    expect(historicalIncomeGroups(groups, "2026-08")).toEqual([]);
    expect(incomeRangeSummary([])).toBeNull();
  });

  it("preserves split receipts and payments across apartments in historical range totals", () => {
    const receipts = [
      entry("split-one", "flat-a", "2026-08-05", "1000"),
      entry("split-two", "flat-a", "2026-08-20", "524"),
      entry("other-flat", "flat-b", "2026-08-28", "3010"),
    ];
    const groups = historicalIncomeGroups(groupIncomeEntriesByReceivedMonth(receipts), "2026-09");
    expect(groups[0]?.entries.map(({ id }) => id)).toEqual(["other-flat", "split-two", "split-one"]);
    expect(incomeRangeSummary(groups)).toMatchObject({ totalGrosz: 453_400, paymentCount: 3, monthCount: 1 });
  });

  it("shows a seven-month current window and leaves future months without fabricated totals", () => {
    const receipts = [entry("june", "flat-a", "2026-06-15", "500"), entry("september", "flat-a", "2026-09-20", "700")];
    const chart = incomeTimeWindow(receipts, new Date(2026, 8, 28), null, 2026);
    expect(chart.map(({ month }) => month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(chart.map(({ totalGrosz, period }) => [totalGrosz, period])).toEqual([[50_000, "actual"], [0, "actual"], [0, "actual"], [70_000, "actual"], [null, "future"], [null, "future"], [null, "future"]]);
    expect(chart.filter(({ selected }) => selected).map(({ month }) => month)).toEqual(["2026-09"]);
  });

  it("keeps months after a selected historical year actual when they are before today", () => {
    const receipts = [entry("jan", "flat-a", "2026-01-12", "500")];
    const chart = incomeTimeWindow(receipts, new Date(2026, 8, 28), null, 2025);
    expect(chart.map(({ month }) => month)).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(chart[4]).toMatchObject({ month: "2026-01", totalGrosz: 50_000, period: "actual" });
    expect(chart.every(({ period }) => period === "actual")).toBe(true);
  });

  it("marks an empty current month as actual zero and keeps future placeholders distinct", () => {
    const chart = incomeTimeWindow([], new Date(2026, 8, 28), null, 2026);
    expect(chart.find(({ selected }) => selected)).toMatchObject({ month: "2026-09", totalGrosz: 0, period: "actual" });
    expect(chart.filter(({ period }) => period === "future").every(({ totalGrosz }) => totalGrosz === null)).toBe(true);
  });

  it("projects apartment rent status for all properties without inventing income records", () => {
    const properties: Property[] = [
      { id: "flat-a", address: "Reduta", ownerRent: "3010", rentSchedule: [{ effectiveFrom: "2026-01", amount: "3010" }] },
      { id: "flat-b", address: "Parkowa", ownerRent: "2524", rentSchedule: [{ effectiveFrom: "2026-01", amount: "2524" }] },
      { id: "flat-c", address: "Lipowa", ownerRent: "1700", rentSchedule: [{ effectiveFrom: "2026-01", amount: "1700" }] },
    ];
    const receipts = [
      { ...entry("reduta", "flat-a", "2026-10-02", "3010"), rentalMonth: "2026-09", taxableAmount: "2800" },
      { ...entry("parkowa-one", "flat-b", "2026-09-10", "1000"), rentalMonth: "2026-09" },
      { ...entry("parkowa-two", "flat-b", "2026-09-20", "500"), rentalMonth: "2026-09" },
    ];
    const rows = rentMonthStatusRows(properties, receipts, "2026-09", new Date(2026, 9, 5));
    expect(rows).toEqual([
      { propertyId: "flat-a", address: "Reduta", expectedGrosz: 301_000, confirmedGrosz: 301_000, remainingGrosz: 0, status: "paid" },
      { propertyId: "flat-b", address: "Parkowa", expectedGrosz: 252_400, confirmedGrosz: 150_000, remainingGrosz: 102_400, status: "partial" },
      { propertyId: "flat-c", address: "Lipowa", expectedGrosz: 170_000, confirmedGrosz: 0, remainingGrosz: 170_000, status: "unpaid" },
    ]);
    expect(receipts).toHaveLength(3);
    expect(rows.some((row) => "id" in row)).toBe(false);
  });

  it("uses effective historical rent while receipt history stays grouped by received date", () => {
    const property: Property = { id: "flat-a", address: "Historyczna", ownerRent: "3500", rentSchedule: [
      { effectiveFrom: "2026-01", amount: "2500" }, { effectiveFrom: "2026-09", amount: "3500" },
    ] };
    const receipt = { ...entry("late", "flat-a", "2026-10-03", "2500"), rentalMonth: "2026-08" };
    expect(rentMonthStatusRows([property], [receipt], "2026-08", new Date(2026, 9, 5))[0]).toMatchObject({ expectedGrosz: 250_000, confirmedGrosz: 250_000, status: "paid" });
    expect(groupIncomeEntriesByReceivedMonth([receipt]).map((group) => group.month)).toEqual(["2026-10"]);
  });

});
