import { describe, expect, it } from "vitest";
import type { AssistantTask } from "./tasks";
import { annualRentalIncome, annualRentalThreshold, attentionSummary, dashboardAttentionTasks, dashboardProgress, dashboardTaskPresentation, dashboardTaxIssueSummary, daysOverdue, historicalTasks, incomeHistory, incomeSectionLabels, primaryDashboardMetrics, rentCheckAgeLabel, rentConfirmationGroups, rentDisplayState, rentIncomeAction, rentStatusLabel, settingsSections, taxPaymentPrompt, unallocatedRentWarning, upcomingTaskPresentation, upcomingTasks } from "./rentalPresentation";
import { formatPolishCount, formatPolishDate } from "./presentationFormat";
import { formatPln } from "./ryczaltTax";

function task(id: string, status: AssistantTask["status"], days: number): AssistantTask {
  return { id, type: "TENANT_PAYMENT_CHECK", title: id, detail: "", dueAt: new Date(2026, 8, 27 + days), notificationAt: new Date(2026, 8, 27 + days),
    status, dismissible: true, manuallyCompletable: false };
}

describe("rental presentation helpers", () => {
  it("calculates safe monthly and annual progress without exposing percentages", () => {
    expect(dashboardProgress(300_000, 300_000)).toEqual({ value: 300_000, total: 300_000, fraction: 1 });
    expect(dashboardProgress(150_000, 300_000).fraction).toBe(0.5);
    expect(dashboardProgress(100, 0).fraction).toBe(0);
    expect(dashboardProgress(12_000_000, 10_000_000).fraction).toBe(1);
  });

  it("labels a passed rent check date without asserting tenant arrears", () => {
    expect(daysOverdue("2026-09", 28, new Date(2026, 8, 28, 23, 59))).toBe(0);
    expect(daysOverdue("2026-09", 28, new Date(2026, 8, 29, 8))).toBe(1);
    expect(daysOverdue("2026-09", 30, new Date(2026, 8, 29, 8))).toBe(0);
    expect(daysOverdue("2026-02", 31, new Date(2026, 2, 1, 8))).toBe(1);
    const expectedButUnconfirmed = rentDisplayState(270_000, 0, 270_000);
    expect(rentStatusLabel(expectedButUnconfirmed)).toBe("Do potwierdzenia");
    expect(rentCheckAgeLabel(daysOverdue("2026-09", 5, new Date(2026, 8, 28, 8)))).toBe("Termin sprawdzenia minął 23 dni temu");
    expect(rentCheckAgeLabel(0)).toBeNull();
  });

  it("uses taxable annual rental income and the configured tax threshold", () => {
    const entries = [
      { id: "a", propertyId: "p", receivedAt: "2026-01-10", amount: "3000.00", taxableAmount: "2500.00" },
      { id: "b", propertyId: "p", receivedAt: "2026-02-10", amount: "2000.00", taxableAmount: "2000.00" },
      { id: "old", propertyId: "p", receivedAt: "2025-12-10", amount: "1000.00", taxableAmount: "1000.00" },
    ];
    expect(annualRentalIncome(entries, 2026)).toBe(450_000);
    expect(annualRentalIncome(entries, 2026, 2_160_000)).toBe(2_610_000);
    expect(annualRentalThreshold(2026)).toBe(10_000_000);
    expect(annualRentalThreshold(2026, true)).toBe(20_000_000);
    expect(dashboardProgress(annualRentalIncome(entries, 2026), annualRentalThreshold(2026)).fraction).toBeCloseTo(0.045);
    const overThreshold = [...entries, { id: "c", propertyId: "p", receivedAt: "2026-03-10", amount: "98000.00", taxableAmount: "98000.00" }];
    expect(dashboardProgress(annualRentalIncome(overThreshold, 2026), annualRentalThreshold(2026)).fraction).toBe(1);
  });

  it("aggregates multiple overdue tax tasks but leaves a single issue compact", () => {
    const taxTask = (id: string, daysLate: number, remainingGrosz: number): AssistantTask => ({
      ...task(id, "needs-attention", -daysLate), type: "TAX_PAYMENT", remainingGrosz,
    });
    expect(dashboardTaxIssueSummary([taxTask("one", 1, 42_500)], new Date(2026, 8, 27))).toBeNull();
    expect(dashboardTaxIssueSummary([taxTask("one", 1, 42_500), taxTask("two", 10, 340_000)], new Date(2026, 8, 27))).toEqual({ count: 2, totalGrosz: 382_500 });
  });

  it("puts only active operational tasks in attention; rent stays with the monthly rent summary", () => {
    const operationalTypes: AssistantTask["type"][] = ["TAX_PAYMENT", "RENTAL_AGREEMENT_END"];
    const active = operationalTypes.map((type) => ({ ...task(type, "needs-attention", 0), type }));
    const rent = { ...task("rent", "needs-attention", 0), type: "TENANT_PAYMENT_CHECK" as const };
    const dismissed = { ...active[0]!, id: "dismissed", status: "dismissed" as const };
    const snoozed = { ...active[1]!, id: "snoozed", status: "snoozed" as const };
    expect(dashboardAttentionTasks([...active, rent, dismissed, snoozed]).map((item) => item.type)).toEqual(operationalTypes);
  });

  it("collapses paid and unpaid rent while retaining detail for partial payment", () => {
    expect(rentDisplayState(270_000, 270_000, 0)).toEqual({ kind: "paid", expectedGrosz: 270_000 });
    expect(rentDisplayState(270_000, 0, 270_000)).toEqual({ kind: "unpaid", remainingGrosz: 270_000 });
    expect(rentDisplayState(270_000, 100_000, 170_000)).toEqual({ kind: "partial", confirmedGrosz: 100_000, expectedGrosz: 270_000, remainingGrosz: 170_000 });
    expect(rentStatusLabel(rentDisplayState(270_000, 100_000, 170_000))).toBe("Częściowo otrzymano");
    expect(rentStatusLabel(rentDisplayState(270_000, 270_000, 0))).toBe("Potwierdzone");
  });

  it("keeps the rent summary amounts distinct for partial and fully confirmed rent, including large values", () => {
    const compact = (grosz: number) => formatPln(grosz).replace(/,00(?= zł)/, "");
    const partial = rentDisplayState(553_400, 301_000, 252_400);
    expect(partial).toMatchObject({ kind: "partial", confirmedGrosz: 301_000, remainingGrosz: 252_400, expectedGrosz: 553_400 });
    expect([301_000, 252_400, 553_400].map(compact)).toEqual(["3 010 zł", "2 524 zł", "5 534 zł"]);

    const fullyConfirmed = rentDisplayState(553_400, 553_400, 0);
    expect(fullyConfirmed).toMatchObject({ kind: "paid", expectedGrosz: 553_400 });
    expect(compact(553_400)).toBe("5 534 zł");
    expect(compact(123_456_789_000)).toBe("1 234 567 890 zł");
  });

  it("excludes paid apartments from pending and reports the all-paid state", () => {
    const groups = rentConfirmationGroups([
      { id: "paid", state: rentDisplayState(270_000, 270_000, 0) },
      { id: "partial", state: rentDisplayState(390_000, 100_000, 290_000) },
    ]);
    expect(groups.pending.map((item) => item.id)).toEqual(["partial"]);
    expect(rentConfirmationGroups([{ state: rentDisplayState(270_000, 270_000, 0) }]).allPaid).toBe(true);
    expect(rentConfirmationGroups([{ state: { kind: "unknown" as const } }])).toMatchObject({ allPaid: false, pending: [{ state: { kind: "unknown" } }] });
  });

  it("keeps pending rent labeled with the current month when viewing historical income", () => {
    const historicalView = incomeSectionLabels("2026-09", 2025);
    expect(historicalView.currentRent).toBe("DO POTWIERDZENIA · WRZESIEŃ 2026");
    expect(historicalView.paymentHistory).toBe("POTWIERDZONE WPŁATY · 2025");
  });

  it("shows only positive unallocated rent as a warning", () => {
    expect(unallocatedRentWarning(0)).toBeNull();
    expect(unallocatedRentWarning(740_000)).toBe("Nieprzypisana nadpłata: 7 400,00 zł");
  });

  it("uses an interactive attention summary only when actionable items exist", () => {
    expect(attentionSummary(0)).toMatchObject({ interactive: false, action: null });
    expect(attentionSummary(2)).toMatchObject({ interactive: true, action: "Pokaż ›" });
  });

  it("shows a single zero-action success state and hides the empty action section", () => {
    expect(dashboardTaskPresentation(0)).toMatchObject({ showActionableSection: false, summary: { label: "✓ Wszystko na dziś załatwione" } });
    expect(dashboardTaskPresentation(2).showActionableSection).toBe(true);
  });

  it("reduces rent action emphasis after all current rent is confirmed", () => {
    expect(rentIncomeAction(1)).toEqual({ primary: true, label: "Potwierdź wpłatę" });
    expect(rentIncomeAction(0)).toEqual({ primary: false, label: "Dodaj inną wpłatę" });
  });

  it("presents upcoming rent with expected rent instead of confirmed receipt value", () => {
    const upcomingRent = { ...task("TENANT_PAYMENT_CHECK:p1:2026-10", "upcoming", 8), expectedGrosz: 260_000, remainingGrosz: 260_000 };
    expect(upcomingTaskPresentation(upcomingRent)).toEqual({ title: "TENANT_PAYMENT_CHECK:p1:2026-10", amount: "2 600,00 zł" });
  });

  it("formats Polish display dates and count plurals", () => {
    expect(formatPolishDate("2026-10-20", "long")).toBe("20 października 2026");
    const apartmentForms = ["mieszkanie", "mieszkania", "mieszkań"] as const;
    expect([1, 2, 5, 12].map((count) => formatPolishCount(count, apartmentForms))).toEqual(["1 mieszkanie", "2 mieszkania", "5 mieszkań", "12 mieszkań"]);
    const billForms = ["rachunek", "rachunki", "rachunków"] as const;
    expect([1, 2, 5, 12].map((count) => formatPolishCount(count, billForms))).toEqual(["1 rachunek", "2 rachunki", "5 rachunków", "12 rachunków"]);
    expect(formatPolishDate(new Date(2026, 9, 5, 12))).toBe("5 paź");
  });

  it("hides tax payment prompts with no due balance, including overpayment", () => {
    expect(taxPaymentPrompt(0, 0, 0)).toMatchObject({ showPayment: false, status: "Brak podatku do zapłaty" });
    expect(taxPaymentPrompt(0, 31_400)).toMatchObject({ showPayment: false, status: "Nadpłata — nie dodawaj kolejnej wpłaty" });
    expect(taxPaymentPrompt(0, 0, 89_400)).toMatchObject({ showPayment: false, status: "Podatek za okres rozliczony" });
    expect(taxPaymentPrompt(50_000, 0).showPayment).toBe(true);
  });

  it("shows only near-term upcoming tasks and keeps finished/dismissed items in one history", () => {
    const tasks = [task("today", "needs-attention", 0), task("soon", "upcoming", 10), task("far", "upcoming", 65), task("done", "completed", -1), task("hidden", "dismissed", -2)];
    expect(upcomingTasks(tasks, new Date(2026, 8, 27)).map((item) => item.id)).toEqual(["soon"]);
    expect(historicalTasks(tasks).map((item) => item.id)).toEqual(["done", "hidden"]);
  });

  it("keeps settings capability reachable by category", () => {
    expect(settingsSections.map(({ label }) => label)).toEqual(["Mieszkania", "Podatek i rozliczenia", "Dane do przelewu", "Powiadomienia", "Dane lokalne"]);
    expect(settingsSections.map(({ label }) => label).join(" ")).not.toMatch(/kopia zapasowa|backup|restore/i);
  });

  it("keeps three dashboard values and six-month chart data available for income", () => {
    const metrics = primaryDashboardMetrics("2 700 zł", "3 900 zł", "230 zł · do 20 paź");
    expect(metrics.map(({ label }) => label)).toEqual(["Otrzymano", "Pozostało", "Podatek"]);
    const entries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-09-12", amount: "2700.00", taxableAmount: "2700.00" }];
    expect(incomeHistory(entries, new Date(2026, 8, 27)).at(-1)).toEqual({ month: "2026-09", total: 270_000 });
    expect(incomeHistory(entries, new Date(2026, 8, 27), "other").at(-1)?.total).toBe(0);
  });
});
