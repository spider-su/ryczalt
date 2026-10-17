import { describe, expect, it } from "vitest";
import {
  canCompleteFirstApartment,
  firstApartmentStepError,
  type FirstApartmentDraft,
} from "./firstApartmentOnboarding";

const base = (): FirstApartmentDraft => ({
  address: "ul. Parkowa 12/4",
  tenantName: "",
  rentalStartDate: "2026-01-01",
  ownerRent: "2500",
  mediaAmount: "350",
  mediaPaidByTenant: true,
  paymentDay: "5",
  taxableTreatment: "OWNER_RENT",
});

describe("first-apartment onboarding", () => {
  it("requires an address but leaves tenant information optional", () => {
    expect(firstApartmentStepError({ ...base(), address: "  " }, 0)).toMatch(/adres/i);
    expect(firstApartmentStepError(base(), 0)).toBeNull();
    expect(firstApartmentStepError({ ...base(), rentalStartDate: "2026-02-30" }, 0)).toMatch(/datę rozpoczęcia/i);
    expect(canCompleteFirstApartment(base())).toBe(true);
  });

  it("validates exact rent and media amounts, allowing Polish decimal commas", () => {
    expect(firstApartmentStepError({ ...base(), ownerRent: "0" }, 1)).toMatch(/czynsz/i);
    expect(firstApartmentStepError({ ...base(), ownerRent: "abc" }, 1)).toMatch(/czynsz/i);
    expect(firstApartmentStepError({ ...base(), ownerRent: "2500,50", mediaAmount: "125,25" }, 1)).toBeNull();
    expect(firstApartmentStepError({ ...base(), mediaAmount: "-1" }, 1)).toMatch(/mediów/i);
    expect(firstApartmentStepError({ ...base(), mediaAmount: "123,456" }, 1)).toMatch(/mediów/i);
    expect(firstApartmentStepError({ ...base(), mediaAmount: "" }, 1)).toBeNull();
  });

  it("requires a valid rent payment day", () => {
    for (const paymentDay of ["", "0", "32", "1.5", "NaN"]) {
      expect(firstApartmentStepError({ ...base(), paymentDay }, 1)).toMatch(/dzień płatności/i);
    }
    expect(firstApartmentStepError({ ...base(), paymentDay: "31" }, 1)).toBeNull();
  });

  it("never guesses tax treatment from who pays utility charges", () => {
    for (const mediaPaidByTenant of [false, true]) {
      const draft = { ...base(), mediaPaidByTenant, taxableTreatment: undefined };
      expect(firstApartmentStepError(draft, 2)).toMatch(/opodatkowania/i);
      expect(canCompleteFirstApartment(draft)).toBe(false);
    }
    expect(canCompleteFirstApartment({ ...base(), taxableTreatment: "RENT_AND_CHARGES" })).toBe(true);
  });

  it("does not allow finishing until every step is valid", () => {
    expect(canCompleteFirstApartment({ ...base(), address: "" })).toBe(false);
    expect(canCompleteFirstApartment({ ...base(), rentalStartDate: "" })).toBe(false);
    expect(canCompleteFirstApartment({ ...base(), ownerRent: "" })).toBe(false);
    expect(canCompleteFirstApartment({ ...base(), paymentDay: "45" })).toBe(false);
    expect(canCompleteFirstApartment(base())).toBe(true);
  });
});
