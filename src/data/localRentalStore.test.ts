import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RENTAL_DOCUMENT_STORAGE_KEY,
  RentalStoreError,
  emptyDocument,
  loadRentalDocument,
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

const storage = vi.mocked(AsyncStorage);

const validDocument: RentalDocument = {
  schemaVersion: 3,
  properties: [
    {
      id: "property-1",
      name: "Mieszkanie testowe",
      defaultMonthlyRent: "2500.00",
    },
  ],
  incomeEntries: [
    {
      id: "income-1",
      propertyId: "property-1",
      receivedAt: "2026-09-10",
      amount: "2500.00",
      taxableAmount: "2500.00",
      rentalMonth: "2026-09",
    },
  ],
  taxPayments: [
    {
      id: "tax-1",
      period: "2026-09",
      paidAt: "2026-10-20",
      amount: "212.50",
    },
  ],
  recurringBills: [],
  billPayments: [],
  propertyLinks: [],
  customReminders: [],
  taskStates: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
};

describe("localRentalStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty versioned document when storage is empty", async () => {
    storage.getItem.mockResolvedValueOnce(null);

    await expect(loadRentalDocument()).resolves.toEqual(emptyDocument());
  });

  it("loads a valid document without changing decimal-string amounts", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(validDocument));

    await expect(loadRentalDocument()).resolves.toEqual(validDocument);
  });

  it("defaults legacy tax settings to monthly without discarding existing data", async () => {
    const legacy = { ...validDocument, schemaVersion: 1, recurringBills: undefined, billPayments: undefined, settings: { taxYear: 2026 } };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(legacy));
    await expect(loadRentalDocument()).resolves.toMatchObject({
      incomeEntries: validDocument.incomeEntries,
      taxPayments: validDocument.taxPayments,
      schemaVersion: 3,
      settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
    });
  });

  it("migrates schema 2 while preserving reminder settings and all recorded history", async () => {
    const schema2 = { ...validDocument, schemaVersion: 2, propertyLinks: undefined, customReminders: undefined, taskStates: undefined,
      settings: { ...validDocument.settings, reminderCategories: { rent: false, agreements: true, tax: true, bills: false } } };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(schema2));
    await expect(loadRentalDocument()).resolves.toMatchObject({
      schemaVersion: 3, incomeEntries: validDocument.incomeEntries, taxPayments: validDocument.taxPayments,
      properties: validDocument.properties, propertyLinks: [], customReminders: [], taskStates: [],
      settings: { reminderCategories: { rent: false, agreements: true, tax: true, bills: false, custom: true } },
    });
  });

  it("reports invalid JSON as corrupted data", async () => {
    storage.getItem.mockResolvedValueOnce("{not-json");

    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "CORRUPTED_DATA",
    } satisfies Partial<RentalStoreError>);
  });

  it("rejects unsupported schema versions", async () => {
    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ ...validDocument, schemaVersion: 4 }),
    );

    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    } satisfies Partial<RentalStoreError>);
  });

  it("rejects impossible dates, invalid property references, and duplicate income IDs", async () => {
    const invalid = {
      ...validDocument,
      incomeEntries: [
        {
          ...validDocument.incomeEntries[0],
          receivedAt: "2025-02-29",
          propertyId: "property-1",
          id: "income-1",
        },
        {
          ...validDocument.incomeEntries[0],
          receivedAt: "2026-09-11",
          id: "income-1",
        },
      ],
    };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(invalid));
    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "CORRUPTED_DATA",
    } satisfies Partial<RentalStoreError>);
  });

  it("rejects taxable amounts above the amount received", async () => {
    const invalid = {
      ...validDocument,
      incomeEntries: [
        {
          ...validDocument.incomeEntries[0],
          amount: "100.00",
          taxableAmount: "100.01",
        },
      ],
    };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(invalid));
    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "CORRUPTED_DATA",
    } satisfies Partial<RentalStoreError>);
  });

  it("validates and saves the document to the rental namespace", async () => {
    storage.setItem.mockResolvedValueOnce();

    await saveRentalDocument(validDocument);

    expect(storage.setItem).toHaveBeenCalledWith(
      RENTAL_DOCUMENT_STORAGE_KEY,
      JSON.stringify(validDocument),
    );
  });

  it("propagates persistence failures instead of replacing the document", async () => {
    storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(saveRentalDocument(validDocument)).rejects.toThrow(
      "storage unavailable",
    );
  });
});
