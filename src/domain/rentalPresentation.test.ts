import { describe, expect, it } from "vitest";
import type { AssistantTask } from "./tasks";
import { attentionSummary, historicalTasks, incomeHistory, incomeSectionLabels, primaryDashboardMetrics, rentConfirmationGroups, rentDisplayState, settingsSections, taxPaymentPrompt, unallocatedRentWarning, upcomingTasks } from "./rentalPresentation";

function task(id: string, status: AssistantTask["status"], days: number): AssistantTask {
  return { id, type: "TENANT_PAYMENT_CHECK", title: id, detail: "", dueAt: new Date(2026, 8, 27 + days), notificationAt: new Date(2026, 8, 27 + days),
    status, dismissible: true, manuallyCompletable: false };
}

describe("rental presentation helpers", () => {
  it("collapses paid and unpaid rent while retaining detail for partial payment", () => {
    expect(rentDisplayState(270_000, 270_000, 0)).toEqual({ kind: "paid", expectedGrosz: 270_000 });
    expect(rentDisplayState(270_000, 0, 270_000)).toEqual({ kind: "unpaid", remainingGrosz: 270_000 });
    expect(rentDisplayState(270_000, 100_000, 170_000)).toEqual({ kind: "partial", confirmedGrosz: 100_000, expectedGrosz: 270_000, remainingGrosz: 170_000 });
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
    expect(unallocatedRentWarning(30_000)).toContain("Nadwyżka wpłaty: 300,00 zł nieprzypisana do czynszu");
  });

  it("uses an interactive attention summary only when actionable items exist", () => {
    expect(attentionSummary(0)).toMatchObject({ interactive: false, action: null });
    expect(attentionSummary(2)).toMatchObject({ interactive: true, action: "Pokaż ›" });
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
    expect(settingsSections.map(({ label }) => label)).toEqual(["Mieszkania", "Podatek i rozliczenia", "Dane do przelewu", "Powiadomienia", "Pozostałe rachunki", "Dane i kopia zapasowa"]);
  });

  it("keeps three dashboard values and six-month chart data available for income", () => {
    const metrics = primaryDashboardMetrics("2 700 zł", "3 900 zł", "230 zł · do 20 paź");
    expect(metrics.map(({ label }) => label)).toEqual(["Otrzymano", "Pozostało", "Podatek"]);
    const entries = [{ id: "i1", propertyId: "p1", receivedAt: "2026-09-12", amount: "2700.00", taxableAmount: "2700.00" }];
    expect(incomeHistory(entries, new Date(2026, 8, 27)).at(-1)).toEqual({ month: "2026-09", total: 270_000 });
    expect(incomeHistory(entries, new Date(2026, 8, 27), "other").at(-1)?.total).toBe(0);
  });
});
