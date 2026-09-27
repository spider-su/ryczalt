import { describe, expect, it } from "vitest";
import { emptyDocument } from "../data/localRentalStore";
import type { Property } from "../model/rental";
import { deriveSetupProgress } from "./setupProgress";

const apartment = (overrides: Partial<Property> = {}): Property => ({ id: "p1", name: "Parkowa", ...overrides });

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
    const document = emptyDocument(); document.properties = [apartment({ defaultMonthlyRent: "2500.00" })];
    expect(deriveSetupProgress(document).nextAction).toMatchObject({ action: "payment-day", label: "Ustaw dzień płatności" });
  });

  it("counts an effective rent schedule as configured expected rent", () => {
    const document = emptyDocument(); document.properties = [apartment({ rentSchedule: [{ effectiveFrom: "2026-01", amount: "2500.00" }], expectedPaymentDay: 10 })];
    expect(deriveSetupProgress(document)).toMatchObject({ totalRequiredSteps: 3, completedRequiredSteps: 3, showGuidance: true, nextAction: { action: "payment-reminder" } });
  });

  it("keeps tenant and portal optional and does not gate completion on them", () => {
    const document = emptyDocument(); document.properties = [apartment({ defaultMonthlyRent: "2500", expectedPaymentDay: 10, paymentReminderEnabled: true })];
    const progress = deriveSetupProgress(document);
    expect(progress).toMatchObject({ completedRequiredSteps: 3, showGuidance: false, nextAction: null });
    expect(progress.optionalSuggestions.map((item) => item.action)).toContain("tenant");
    expect(progress.optionalSuggestions.map((item) => item.action)).toContain("administrator-portal");
  });

  it("suggests a reminder but never marks it enabled or requires OS permission", () => {
    const document = emptyDocument(); document.properties = [apartment({ defaultMonthlyRent: "2500", expectedPaymentDay: 10 })];
    expect(deriveSetupProgress(document).nextAction?.action).toBe("payment-reminder");
    expect(document.properties[0]?.paymentReminderEnabled).toBeUndefined();
  });

  it("respects the user's disabled rent-reminder category", () => {
    const document = emptyDocument();
    document.properties = [apartment({ defaultMonthlyRent: "2500", expectedPaymentDay: 10 })];
    document.settings.reminderCategories.rent = false;
    expect(deriveSetupProgress(document)).toMatchObject({ showGuidance: false, nextAction: null });
  });

  it("targets the first incomplete apartment without making optional data mandatory for others", () => {
    const document = emptyDocument();
    document.properties = [
      apartment({ defaultMonthlyRent: "2500", expectedPaymentDay: 10, paymentReminderEnabled: true }),
      apartment({ id: "p2", name: "Długa", defaultMonthlyRent: "1800" }),
    ];
    expect(deriveSetupProgress(document)).toMatchObject({ totalRequiredSteps: 6, completedRequiredSteps: 5, nextAction: { propertyId: "p2", propertyName: "Długa", action: "payment-day" } });
  });

  it("updates derived progress after editing and hides required guidance when complete", () => {
    const document = emptyDocument(); document.properties = [apartment({ defaultMonthlyRent: "2500" })];
    expect(deriveSetupProgress(document).completedRequiredSteps).toBe(2);
    document.properties[0]!.expectedPaymentDay = 10;
    document.properties[0]!.paymentReminderEnabled = true;
    expect(deriveSetupProgress(document)).toMatchObject({ completedRequiredSteps: 3, showGuidance: false, nextAction: null });
  });
});
