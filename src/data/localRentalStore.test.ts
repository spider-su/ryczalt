import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RENTAL_DOCUMENT_BACKUP_KEY,
  RENTAL_DOCUMENT_STORAGE_KEY,
  LEGACY_RENTAL_DOCUMENT_STORAGE_KEY,
  RentalStoreError,
  createRentalBackup,
  emptyDocument,
  loadRentalDocument,
  loadRentalDocumentWithStatus,
  parseRentalBackup,
  readRawRentalDocument,
  resetRentalDocument,
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("./secureLocalStorage", () => ({
  getProtectedItem: (key: string) => AsyncStorage.getItem(key),
  setProtectedItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeProtectedItem: (key: string) => AsyncStorage.removeItem(key),
  removeLocalEncryptionKey: vi.fn(),
  isEncryptedLocalValue: (value: string | null) => value?.startsWith("ryczalt-encrypted:v1:") ?? false,
}));

const storage = vi.mocked(AsyncStorage);

const validDocument: RentalDocument = {
  schemaVersion: 1,
  properties: [
    {
      id: "property-1",
      address: "Mieszkanie testowe",
      lifecycle: "ACTIVE",
      ownerRent: "2500.00",
      mediaAmount: "0.00",
      mediaPaidByTenant: false,
      taxableTreatment: "OWNER_RENT",
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
  administrationSuggestions: [],
  customReminders: [],
  taskStates: [],
  apartmentPeriods: [],
  taxSettlementSnapshots: [],
  settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 },
};

describe("localRentalStore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storage.getItem.mockResolvedValue(null);
  });

  it("returns an empty versioned document when storage is empty", async () => {
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(loadRentalDocument()).resolves.toEqual(emptyDocument());
  });

  it("migrates a current-format legacy namespace without deleting the source", async () => {
    storage.getItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(validDocument));
    storage.setItem.mockResolvedValueOnce();

    await expect(loadRentalDocument()).resolves.toEqual(validDocument);
    expect(storage.setItem).toHaveBeenCalledWith(RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(validDocument));
    expect(storage.removeItem).not.toHaveBeenCalledWith(LEGACY_RENTAL_DOCUMENT_STORAGE_KEY);
  });

  it("loads a valid document without changing decimal-string amounts", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(validDocument));

    await expect(loadRentalDocument()).resolves.toEqual(validDocument);
  });

  it("round-trips optional opening balances without adding income or tax payment rows", async () => {
    const withOpening = { ...validDocument, settings: { ...validDocument.settings, openingTaxableRevenue: "21600.00", openingTaxPaid: "1836.00" } };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(withOpening));
    await expect(loadRentalDocument()).resolves.toEqual(withOpening);
    expect(withOpening.incomeEntries).toHaveLength(validDocument.incomeEntries.length);
    expect(withOpening.taxPayments).toHaveLength(validDocument.taxPayments.length);
  });

  it("recovers a corrupted primary from the last-good backup and reports recovery", async () => {
    storage.getItem.mockResolvedValueOnce("{broken primary").mockResolvedValueOnce(JSON.stringify(validDocument));
    await expect(loadRentalDocumentWithStatus()).resolves.toEqual({ document: validDocument, recoveredFromBackup: true });
  });

  it("keeps the corruption error when both primary and backup are corrupted", async () => {
    storage.getItem.mockResolvedValueOnce("{broken primary").mockResolvedValueOnce("{broken backup");
    await expect(loadRentalDocument()).rejects.toMatchObject({ code: "CORRUPTED_DATA" });
  });

  it("round-trips a populated current-schema fixture", async () => {
    const current = validDocument;
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    storage.setItem.mockResolvedValueOnce();
    await saveRentalDocument(current);
    storage.getItem.mockResolvedValueOnce(JSON.stringify(current));
    await expect(loadRentalDocument()).resolves.toEqual(current);
  });

  it("round-trips a portable backup without changing the rental document", () => {
    const raw = createRentalBackup(validDocument, "2026-09-29T10:00:00.000Z");
    expect(parseRentalBackup(raw)).toEqual(validDocument);
    expect(JSON.parse(raw)).toMatchObject({
      format: "pl.ryczalt.rental.backup",
      backupVersion: 1,
      exportedAt: "2026-09-29T10:00:00.000Z",
    });
  });

  it("rejects malformed, unsupported, or invalid backup files before restore", () => {
    expect(() => parseRentalBackup("{broken")).toThrow(RentalStoreError);
    expect(() => parseRentalBackup(JSON.stringify({
      format: "pl.ryczalt.rental.backup",
      backupVersion: 2,
      exportedAt: "2026-09-29T10:00:00.000Z",
      document: validDocument,
    }))).toThrow(RentalStoreError);
    expect(() => parseRentalBackup(JSON.stringify({
      format: "pl.ryczalt.rental.backup",
      backupVersion: 1,
      exportedAt: "2026-09-29T10:00:00.000Z",
      document: { ...validDocument, schemaVersion: 99 },
    }))).toThrow(RentalStoreError);
  });

  it("reports invalid JSON as corrupted data", async () => {
    storage.getItem.mockResolvedValueOnce("{not-json");

    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "CORRUPTED_DATA",
    } satisfies Partial<RentalStoreError>);
  });

  it("copies corrupt raw data on request and resets only when explicitly called", async () => {
    storage.getItem.mockResolvedValueOnce("{broken source data");
    await expect(readRawRentalDocument()).resolves.toBe("{broken source data");
    expect(storage.removeItem).not.toHaveBeenCalled();

    storage.removeItem.mockResolvedValueOnce();
    await resetRentalDocument();
    expect(storage.removeItem).toHaveBeenCalledWith(RENTAL_DOCUMENT_STORAGE_KEY);
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await expect(loadRentalDocument()).resolves.toEqual(emptyDocument());
  });

  it("resets valid local data to the normal empty-document startup state", async () => {
    storage.removeItem.mockResolvedValue();
    await resetRentalDocument();
    expect(storage.removeItem).toHaveBeenNthCalledWith(1, RENTAL_DOCUMENT_BACKUP_KEY);
    expect(storage.removeItem).toHaveBeenNthCalledWith(2, RENTAL_DOCUMENT_STORAGE_KEY);
    storage.getItem.mockResolvedValueOnce(null);
    await expect(loadRentalDocument()).resolves.toEqual(emptyDocument());
  });

  it("rejects unsupported schema versions", async () => {
    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ ...validDocument, schemaVersion: 2 }),
    );

    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    } satisfies Partial<RentalStoreError>);
  });

  it("does not recover a backup over an unsupported primary schema", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify({ ...validDocument, schemaVersion: 2 })).mockResolvedValueOnce(JSON.stringify(validDocument));
    await expect(loadRentalDocument()).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });
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

  it.each([
    ["income receipt date", (doc: RentalDocument) => { doc.incomeEntries[0]!.receivedAt = "2026-9-10"; }],
    ["rental month", (doc: RentalDocument) => { doc.incomeEntries[0]!.rentalMonth = "2026-13"; }],
    ["agreement end date", (doc: RentalDocument) => { doc.properties[0]!.leaseEndDate = "2026-02-30"; }],
    ["rent effective month", (doc: RentalDocument) => { doc.properties[0]!.rentSchedule = [{ effectiveFrom: "2026-9", amount: "1.00" }]; }],
    ["tax payment period", (doc: RentalDocument) => { doc.taxPayments[0]!.period = "2026-Q5"; }],
    ["tax payment date", (doc: RentalDocument) => { doc.taxPayments[0]!.paidAt = "2026-10-20T00:00:00Z"; }],
    ["reminder due date", (doc: RentalDocument) => { doc.customReminders = [{ id: "r1", title: "Termin", dueDate: "2026-02-30", recurrence: "ONCE" }]; }],
    ["bill payment period", (doc: RentalDocument) => { doc.recurringBills = [{ id: "b1", propertyId: "property-1", name: "Prąd", reminderEnabled: false }]; doc.billPayments = [{ id: "bp1", billId: "b1", period: "2026-13", paidAt: "2026-09-10", amount: "1.00" }]; }],
    ["bill payment date", (doc: RentalDocument) => { doc.recurringBills = [{ id: "b1", propertyId: "property-1", name: "Prąd", reminderEnabled: false }]; doc.billPayments = [{ id: "bp1", billId: "b1", period: "2026-09", paidAt: "2026-09-31", amount: "1.00" }]; }],
  ])("rejects malformed stored %s", async (_field, corrupt) => {
    const invalid = structuredClone(validDocument);
    corrupt(invalid);
    storage.getItem.mockResolvedValueOnce(JSON.stringify(invalid));
    await expect(loadRentalDocument()).rejects.toMatchObject({ code: "CORRUPTED_DATA" });
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
    storage.getItem.mockResolvedValueOnce(null);
    storage.setItem.mockResolvedValueOnce();

    await saveRentalDocument(validDocument);

    expect(storage.setItem).toHaveBeenCalledWith(
      RENTAL_DOCUMENT_STORAGE_KEY,
      JSON.stringify(validDocument),
    );
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalledWith(RENTAL_DOCUMENT_BACKUP_KEY, expect.any(String));
  });

  it("propagates persistence failures instead of replacing the document", async () => {
    storage.getItem.mockResolvedValueOnce(null);
    storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(saveRentalDocument(validDocument)).rejects.toThrow(
      "storage unavailable",
    );
  });

  it("snapshots the valid primary before writing the replacement", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(validDocument));
    storage.setItem.mockResolvedValue();
    const replacement = { ...validDocument, incomeEntries: [] };
    await saveRentalDocument(replacement);
    expect(storage.setItem).toHaveBeenNthCalledWith(1, RENTAL_DOCUMENT_BACKUP_KEY, JSON.stringify(validDocument));
    expect(storage.setItem).toHaveBeenNthCalledWith(2, RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(replacement));
  });

  it("does not destroy the last-good backup if writing its replacement fails", async () => {
    const previousBackup = JSON.stringify({ ...validDocument, incomeEntries: [] });
    const values = new Map<string, string>([
      [RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(validDocument)],
      [RENTAL_DOCUMENT_BACKUP_KEY, previousBackup],
    ]);
    storage.getItem.mockImplementation(async (key) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => {
      if (key === RENTAL_DOCUMENT_BACKUP_KEY) throw new Error("backup write failed");
      values.set(key, value);
    });
    await expect(saveRentalDocument({ ...validDocument, incomeEntries: [] })).rejects.toThrow("backup write failed");
    expect(values.get(RENTAL_DOCUMENT_BACKUP_KEY)).toBe(previousBackup);
    expect(values.get(RENTAL_DOCUMENT_STORAGE_KEY)).toBe(JSON.stringify(validDocument));
  });
});
