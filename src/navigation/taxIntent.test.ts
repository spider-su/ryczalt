import { describe, expect, it, vi } from "vitest";
import { navigateToTaxDetails } from "./taxIntent";

describe("tax details navigation", () => {
  it("opens the tax screen from the Pulpit tax summary and arrears action", () => {
    const navigation = { navigate: vi.fn() };

    navigateToTaxDetails(navigation);

    expect(navigation.navigate).toHaveBeenCalledWith("Podatek");
  });

  it("preserves a specific period when opening a tax task", () => {
    const navigation = { navigate: vi.fn() };

    navigateToTaxDetails(navigation, "2026-09");

    expect(navigation.navigate).toHaveBeenCalledWith("Podatek", { period: "2026-09" });
  });
});
