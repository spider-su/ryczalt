import { describe, expect, it } from "vitest";
import type { IncomeEntry, Property } from "../model/rental";
import { createIncomeEntry, editIncomeEntry } from "./rentalOperations";

const property: Property = { id: "flat-1", address: "Reduta 26B / 44", tenantName: "Current tenant", ownerRent: "2600" };

describe("income tenant history", () => {
  it("snapshots the tenant on receipt creation and preserves the original tenant when editing history", () => {
    const created = createIncomeEntry({ propertyId: property.id, receivedAt: "2026-09-28", amount: "2600", taxableAmount: "2600", rentalMonth: "2026-09" }, property, "income-1");
    expect(created.tenantNameSnapshot).toBe("Current tenant");

    const historical: IncomeEntry = { ...created, tenantNameSnapshot: "Former tenant" };
    const edited = editIncomeEntry(historical, { propertyId: property.id, receivedAt: "2026-09-29", amount: "2700", taxableAmount: "2700", rentalMonth: "2026-09" });
    expect(edited.tenantNameSnapshot).toBe("Former tenant");
  });

  it("retains INITIAL_IMPORT provenance when correcting an estimated receipt", () => {
    const imported: IncomeEntry = { id: "import-1", propertyId: property.id, receivedAt: "2026-03-12", amount: "2600", taxableAmount: "2600", rentalMonth: "2026-03", source: "INITIAL_IMPORT" };
    expect(editIncomeEntry(imported, { propertyId: property.id, receivedAt: "2026-03-14", amount: "2600", taxableAmount: "2600", rentalMonth: "2026-03" }).source).toBe("INITIAL_IMPORT");
  });
});
