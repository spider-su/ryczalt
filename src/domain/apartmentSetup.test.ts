import { describe, expect, it } from "vitest";
import { ELECTRICITY_PROVIDER_PRESETS, leaseEndOneYearAfter, mergeAdministrationSuggestions, newApartmentDefaults } from "./apartmentSetup";
import { isValidHttpsUrl } from "./rentalValidation";

describe("apartment setup helpers", () => {
  it("defaults a new lease to one year after the selected date and clamps leap days", () => {
    expect(leaseEndOneYearAfter("2026-09-28")).toBe("2027-09-28");
    expect(leaseEndOneYearAfter("2028-02-29")).toBe("2029-02-28");
  });

  it("defaults the rent due day to 5 for a new apartment", () => {
    expect(newApartmentDefaults("2026-09-28")).toEqual({ leaseEndDate: "2027-09-28", paymentDay: 5 });
  });

  it("deduplicates saved administration names case-insensitively and keeps the latest URL", () => {
    const existing = [{ name: "Administracja ABC", url: "https://old.example" }];
    expect(mergeAdministrationSuggestions(existing, { name: "  administracja abc ", url: "https://new.example" })).toEqual([
      { name: "Administracja ABC", url: "https://new.example" },
    ]);
  });

  it("provides the focused electricity provider presets", () => {
    expect(ELECTRICITY_PROVIDER_PRESETS.map(({ name }) => name)).toEqual(["TAURON", "PGE", "Enea", "Energa", "E.ON"]);
    expect(ELECTRICITY_PROVIDER_PRESETS.every(({ url }) => url.startsWith("https://"))).toBe(true);
  });

  it("accepts HTTPS provider links and rejects unsafe schemes", () => {
    expect(isValidHttpsUrl("https://supplier.example" )).toBe(true);
    for (const url of ["javascript:alert(1)", "intent://supplier", "http://supplier.example"]) expect(isValidHttpsUrl(url)).toBe(false);
  });
});
