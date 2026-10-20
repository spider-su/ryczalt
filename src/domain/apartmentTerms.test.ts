import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { apartmentTermsChangedForMonth, hasConfirmedRentForMonth, termsChangeMustStartNextMonth } from "./apartmentTerms";

const property: Property = {
  id: "flat-a",
  address: "Parkowa",
  ownerRent: "1000.00",
  mediaAmount: "0.00",
  mediaPaidByTenant: true,
  taxableTreatment: "OWNER_RENT",
  paymentDay: 5,
  rentSchedule: [{
    effectiveFrom: "2026-01",
    amount: "1000.00",
    mediaAmount: "0.00",
    mediaPaidByTenant: true,
    taxableTreatment: "OWNER_RENT",
    paymentDay: 5,
  }],
};

const receipt: IncomeEntry = {
  id: "receipt-oct",
  propertyId: "flat-a",
  receivedAt: "2026-10-10",
  rentalMonth: "2026-10",
  amount: "1000.00",
  taxableAmount: "1000.00",
};

describe("apartment terms with confirmed rent", () => {
  it("matches confirmed receipts by rental month and falls back to received month", () => {
    expect(hasConfirmedRentForMonth("flat-a", [receipt], "2026-10")).toBe(true);
    expect(hasConfirmedRentForMonth("flat-a", [{ ...receipt, rentalMonth: undefined }], "2026-10")).toBe(true);
    expect(hasConfirmedRentForMonth("flat-a", [receipt], "2026-11")).toBe(false);
    expect(hasConfirmedRentForMonth("flat-b", [receipt], "2026-10")).toBe(false);
  });

  it("detects a rent-term change that must not rewrite an already-confirmed month", () => {
    expect(apartmentTermsChangedForMonth(property, "2026-10", {
      amount: "1100.00",
      mediaAmount: "0.00",
      mediaPaidByTenant: true,
      taxableTreatment: "OWNER_RENT",
      paymentDay: 5,
    })).toBe(true);
  });

  it("allows contact-only edits and unchanged current-month terms", () => {
    expect(apartmentTermsChangedForMonth(property, "2026-10", {
      amount: "1000",
      mediaAmount: "0",
      mediaPaidByTenant: true,
      taxableTreatment: "OWNER_RENT",
      paymentDay: 5,
    })).toBe(false);
  });

  it("defers changes when utilities were approved even without a rent receipt", () => {
    const raised = { amount: "1000.00", mediaAmount: "70.00", mediaPaidByTenant: true,
      taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 };
    expect(termsChangeMustStartNextMonth(property, [], "2026-10", "2026-10", raised, true)).toBe(true);
    expect(termsChangeMustStartNextMonth(property, [], "2026-10", "2026-11", raised, true)).toBe(false);
    expect(termsChangeMustStartNextMonth(property, [], "2026-10", "2026-10", raised, false)).toBe(false);
    expect(termsChangeMustStartNextMonth(property, [], "2026-10", "2026-10",
      { ...raised, mediaAmount: "0.00" }, true)).toBe(false);
  });

  it("requires changed terms to start next month after a receipt is confirmed", () => {
    const changed = {
      amount: "1100.00",
      mediaAmount: "0.00",
      mediaPaidByTenant: true,
      taxableTreatment: "OWNER_RENT" as const,
      paymentDay: 5,
    };
    expect(termsChangeMustStartNextMonth(property, [receipt], "2026-10", "2026-10", changed)).toBe(true);
    expect(termsChangeMustStartNextMonth(property, [receipt], "2026-10", "2026-11", changed)).toBe(false);
    expect(termsChangeMustStartNextMonth(property, [], "2026-10", "2026-10", changed)).toBe(false);
    expect(termsChangeMustStartNextMonth(property, [receipt], "2026-10", "2026-10", {
      ...changed,
      amount: "1000.00",
    })).toBe(false);
  });
});
