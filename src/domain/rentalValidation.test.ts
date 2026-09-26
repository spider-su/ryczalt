import { describe, expect, it } from "vitest";
import {
  isNonnegativeMoney,
  isPositiveMoney,
  isRentalMonth,
  isValidCalendarDate,
  validateIncomeValues,
  validateRentalDocumentShape,
} from "./rentalValidation";
import { createIncomeEntry, editIncomeEntry } from "./rentalOperations";
import { entriesForTaxYear } from "./rentalHistory";
import type { IncomeEntry, RentalDocument } from "../model/rental";

const property = { id: "property-1", name: "Mieszkanie" };
const entry = (
  id: string,
  receivedAt: string,
  amount = "100.00",
  taxableAmount = amount,
): IncomeEntry => ({
  id,
  propertyId: property.id,
  receivedAt,
  amount,
  taxableAmount,
  tenantNameSnapshot: "Stary najemca",
});

describe("rental validation and operations", () => {
  it("validates actual dates and exact monetary strings", () => {
    expect(isValidCalendarDate("2024-02-29")).toBe(true);
    expect(isValidCalendarDate("2025-02-29")).toBe(false);
    expect(isValidCalendarDate("2026-04-31")).toBe(false);
    expect(isRentalMonth("2026-09")).toBe(true);
    expect(isRentalMonth("2026-13")).toBe(false);
    expect(isPositiveMoney("100.00")).toBe(true);
    expect(isPositiveMoney("0.00")).toBe(false);
    expect(isNonnegativeMoney("0.00")).toBe(true);
    expect(isPositiveMoney("10.123")).toBe(false);
  });

  it("creates and edits received versus taxable amounts without changing tenant history", () => {
    const created = createIncomeEntry(
      {
        propertyId: property.id,
        receivedAt: "2026-09-10",
        amount: "1250.00",
        taxableAmount: "1000.00",
      },
      { ...property, tenantName: "Anna" },
      "income-1",
    );
    const edited = editIncomeEntry(created, {
      propertyId: property.id,
      receivedAt: "2026-09-11",
      amount: "500.00",
      taxableAmount: "400.00",
    });
    expect(created).toMatchObject({
      amount: "1250.00",
      taxableAmount: "1000.00",
      tenantNameSnapshot: "Anna",
    });
    expect(edited).toMatchObject({
      amount: "500.00",
      taxableAmount: "400.00",
      tenantNameSnapshot: "Anna",
    });
  });

  it("rejects invalid references and taxable amounts greater than received", () => {
    expect(() =>
      validateIncomeValues(
        {
          propertyId: "missing",
          receivedAt: "2026-09-10",
          amount: "1.00",
          taxableAmount: "1.00",
        },
        [property],
      ),
    ).toThrow();
    expect(() =>
      validateIncomeValues(
        {
          propertyId: property.id,
          receivedAt: "2026-09-10",
          amount: "1.00",
          taxableAmount: "1.01",
        },
        [property],
      ),
    ).toThrow();
  });

  it("filters by receipt year and sorts newest first, independent of rental month", () => {
    const entries = [
      entry("income-1", "2026-01-02"),
      entry("income-2", "2026-12-01", "50.00"),
      entry("income-3", "2025-12-31"),
    ];
    entries[0]!.rentalMonth = "2025-12";
    expect(entriesForTaxYear(entries, 2026).map((item) => item.id)).toEqual([
      "income-2",
      "income-1",
    ]);
  });

  it("rejects duplicate entry IDs and unknown property references in documents", () => {
    const document: RentalDocument = {
      schemaVersion: 2,
      properties: [property],
      incomeEntries: [
        entry("income-1", "2026-01-01"),
        entry("income-1", "2026-01-02"),
      ],
      taxPayments: [],
      recurringBills: [],
      billPayments: [],
      settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true } },
    };
    expect(() => validateRentalDocumentShape(document)).toThrow();
  });
});
