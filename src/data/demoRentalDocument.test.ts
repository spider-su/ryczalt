import { describe, expect, it, vi } from "vitest";
import { applyRentalDocumentChange, createDemoRentalDocument, shouldReconcileNotifications } from "./demoRentalDocument";
import { calculateSettlements } from "../domain/ryczaltTax";
import { taskNotificationPlan } from "../domain/tasks";

describe("isolated demo rental data", () => {
  const now = new Date(2026, 8, 28, 12);

  it("keeps demo edits in memory and leaves normal data unchanged when demo exits or restarts", async () => {
    const realDocument = createDemoRentalDocument(now);
    const demoDocument = createDemoRentalDocument(now);
    const persist = vi.fn(async () => undefined);
    const changed = await applyRentalDocumentChange(demoDocument, (current) => ({
      ...current,
      properties: current.properties.map((property) => property.id === "demo-reduta" ? { ...property, notes: "Demo only" } : property),
    }), true, persist);

    expect(changed.properties[0]?.notes).toBe("Demo only");
    expect(demoDocument.properties[0]?.notes).toBeUndefined();
    expect(realDocument.properties[0]?.notes).toBeUndefined();
    expect(persist).not.toHaveBeenCalled();
    expect(createDemoRentalDocument(now).properties[0]?.notes).toBeUndefined();
  });

  it("persists normal-mode edits through the normal repository callback", async () => {
    const document = createDemoRentalDocument(now);
    const persist = vi.fn(async () => undefined);
    await applyRentalDocumentChange(document, (current) => ({ ...current, customReminders: [] }), false, persist);
    expect(persist).toHaveBeenCalledOnce();
  });

  it("uses production tax calculations with a paid previous period and tax still due this month", () => {
    const document = createDemoRentalDocument(now);
    const settlements = calculateSettlements({ entries: document.incomeEntries, payments: document.taxPayments, taxYear: 2026, mode: "monthly", today: "2026-09-28" });
    expect(document.taxPayments).toHaveLength(1);
    expect(settlements.find((item) => item.period === "2026-08")?.status).toBe("paid");
    expect(settlements.find((item) => item.period === "2026-09")?.outstandingGrosz).toBeGreaterThan(0);
  });

  it("shows a fully paid apartment, a partial apartment, and one grouped upcoming rent reminder", () => {
    const document = createDemoRentalDocument(now);
    expect(document.incomeEntries.some((entry) => entry.propertyId === "demo-reduta" && entry.rentalMonth === "2026-09")).toBe(true);
    expect(document.incomeEntries.some((entry) => entry.propertyId === "demo-mogilska" && entry.rentalMonth === "2026-09")).toBe(true);
    const nextMonthGroupedRent = taskNotificationPlan(document, now).find((item) => item.data.taskIds?.length === 2);
    expect(nextMonthGroupedRent?.data.period).toBe("2026-10");
  });

  it("never reconciles or schedules OS notifications during demo mode", () => {
    expect(shouldReconcileNotifications(true, true, true)).toBe(false);
    expect(shouldReconcileNotifications(false, true, true)).toBe(true);
    expect(shouldReconcileNotifications(false, false, true)).toBe(false);
    expect(shouldReconcileNotifications(false, true, false)).toBe(false);
  });
});
