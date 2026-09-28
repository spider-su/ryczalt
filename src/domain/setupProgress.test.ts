import { describe, expect, it } from "vitest";
import { emptyDocument } from "../data/localRentalStore";
import { dashboardAttentionTasks } from "./rentalPresentation";
import { deriveTasks } from "./tasks";
import type { Property } from "../model/rental";
import { deriveSetupProgress } from "./setupProgress";

const apartment = (overrides: Partial<Property> = {}): Property => ({ id: "p1", address: "Parkowa", ...overrides });

describe("deriveSetupProgress", () => {
  it("offers adding the first apartment as the single first action", () => {
    const progress = deriveSetupProgress(emptyDocument());
    expect(progress).toMatchObject({ totalRequiredSteps: 3, completedRequiredSteps: 0, showGuidance: true, nextAction: { action: "apartment", label: "Dodaj mieszkanie" } });
  });

  it("reports missing rent for a name-only apartment", () => {
    const document = emptyDocument(); document.properties = [apartment()];
    expect(deriveSetupProgress(document).nextAction).toMatchObject({ action: "rent", propertyId: "p1" });
  });

  it("requires a payment day after rent is configured", () => {
    const document = emptyDocument(); document.properties = [apartment({ ownerRent: "2500.00" })];
    expect(deriveSetupProgress(document).nextAction).toMatchObject({ action: "payment-day", label: "Ustaw dzień płatności" });
  });

  it("counts an effective rent schedule as configured expected rent", () => {
    const document = emptyDocument(); document.properties = [apartment({ rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00", mediaAmount: "0.00", mediaPaidByTenant: false, taxableTreatment: "OWNER_RENT", paymentDay: 5 }], paymentDay: 10 })];
    expect(deriveSetupProgress(document)).toMatchObject({ totalRequiredSteps: 3, completedRequiredSteps: 3, showGuidance: false, nextAction: null });
  });

  it("hides setup guidance after required setup and keeps missing optional details out of attention", () => {
    const document = emptyDocument(); document.properties = [apartment({ ownerRent: "2500", paymentDay: 10 })];
    const progress = deriveSetupProgress(document);
    expect(progress).toMatchObject({ completedRequiredSteps: 3, showGuidance: false, nextAction: null });
    expect(document.properties[0]?.tenantName).toBeUndefined();
    expect(document.properties[0]?.leaseEndDate).toBeUndefined();
    expect(document.properties[0]?.administrationUrl).toBeUndefined();
    expect(dashboardAttentionTasks(deriveTasks(document, new Date(2026, 8, 28, 12)))).toEqual([]);
  });

  it("does not keep required setup guidance open for optional reminder preferences", () => {
    const document = emptyDocument(); document.properties = [apartment({ ownerRent: "2500", paymentDay: 10 })];
    expect(deriveSetupProgress(document)).toMatchObject({ showGuidance: false, nextAction: null });
  });

  it("respects the user's disabled rent-reminder category", () => {
    const document = emptyDocument();
    document.properties = [apartment({ ownerRent: "2500", paymentDay: 10 })];
    document.settings.reminderCategories.rent = false;
    expect(deriveSetupProgress(document)).toMatchObject({ showGuidance: false, nextAction: null });
  });

  it("targets the first incomplete apartment without making optional data mandatory for others", () => {
    const document = emptyDocument();
    document.properties = [
      apartment({ ownerRent: "2500", paymentDay: 10 }),
      apartment({ id: "p2", address: "Długa", ownerRent: "1800" }),
    ];
    expect(deriveSetupProgress(document)).toMatchObject({ totalRequiredSteps: 6, completedRequiredSteps: 5, nextAction: { propertyId: "p2", propertyName: "Długa", action: "payment-day" } });
  });

  it("updates derived progress after editing and hides required guidance when complete", () => {
    const document = emptyDocument(); document.properties = [apartment({ ownerRent: "2500" })];
    expect(deriveSetupProgress(document).completedRequiredSteps).toBe(2);
    document.properties[0]!.paymentDay = 10;
    expect(deriveSetupProgress(document)).toMatchObject({ completedRequiredSteps: 3, showGuidance: false, nextAction: null });
  });
});
