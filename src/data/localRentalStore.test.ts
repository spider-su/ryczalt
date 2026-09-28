import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schemaV1 from "./fixtures/schema-v1-populated.json";
import schemaV2 from "./fixtures/schema-v2-populated.json";
import schemaV3 from "./fixtures/schema-v3-populated.json";
import schemaV4 from "./fixtures/schema-v4-populated.json";

import {
  RENTAL_DOCUMENT_BACKUP_KEY,
  RENTAL_DOCUMENT_STORAGE_KEY,
  RentalStoreError,
  emptyDocument,
  loadRentalDocument,
  loadRentalDocumentWithStatus,
  readRawRentalDocument,
  resetRentalDocument,
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";
import { deriveTasks } from "../domain/tasks";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const storage = vi.mocked(AsyncStorage);

const validDocument: RentalDocument = {
  schemaVersion: 4,
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
    vi.resetAllMocks();
    storage.getItem.mockResolvedValue(null);
  });

  it("returns an empty versioned document when storage is empty", async () => {
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

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
      schemaVersion: 4,
      settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true } },
    });
  });

  it("migrates schema 2 while preserving reminder settings and all recorded history", async () => {
    const schema2 = { ...validDocument, schemaVersion: 2, propertyLinks: undefined, customReminders: undefined, taskStates: undefined,
      settings: { ...validDocument.settings, reminderCategories: { rent: false, agreements: true, tax: true, bills: false } } };
    storage.getItem.mockResolvedValueOnce(JSON.stringify(schema2));
    await expect(loadRentalDocument()).resolves.toMatchObject({
      schemaVersion: 4, incomeEntries: validDocument.incomeEntries, taxPayments: validDocument.taxPayments,
      properties: validDocument.properties, propertyLinks: [], customReminders: [], taskStates: [],
      settings: { reminderCategories: { rent: false, agreements: true, tax: true, bills: false, custom: true } },
    });
  });

  it("migrates a populated schema 1 fixture without losing tenant, income, or tax history", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(schemaV1));
    await expect(loadRentalDocument()).resolves.toMatchObject({
      schemaVersion: 4,
      properties: [{ id: "property-old", tenantSince: "2024-03-01", tenantName: "Anna Kowalska" }],
      incomeEntries: [{ id: "income-old", tenantNameSnapshot: "Anna Kowalska", rentalMonth: "2025-02" }],
      taxPayments: [{ id: "tax-old", amount: "212.50" }],
      propertyLinks: [], customReminders: [], taskStates: [],
    });
  });

  it("migrates a populated schema 2 fixture including bill-payment history and preferences", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(schemaV2));
    await expect(loadRentalDocument()).resolves.toMatchObject({
      schemaVersion: 4,
      properties: [{ id: "property-v2", tenantName: "Marek Nowak" }],
      incomeEntries: [{ id: "income-v2", taxableAmount: "3000.00" }],
      taxPayments: [{ id: "tax-v2" }],
      recurringBills: [{ id: "bill-v2" }],
      billPayments: [{ id: "bill-payment-v2" }],
      settings: { reminderCategories: { rent: false, custom: true } },
    });
  });

  it("migrates populated schema 3 reminders to ONCE without losing document or task history", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(schemaV3));
    const migrated = await loadRentalDocument();
    expect(migrated).toMatchObject({
      schemaVersion: 4,
      properties: [{ id: "property-current", tenantName: "Joanna Nowak" }],
      incomeEntries: [{ id: "income-current", tenantNameSnapshot: "Joanna Nowak" }],
      taxPayments: [{ id: "tax-current" }],
      recurringBills: [{ id: "bill-current" }],
      billPayments: [{ id: "bill-payment-current" }],
      propertyLinks: [{ id: "link-current" }],
      customReminders: [{ id: "reminder-current", dueDate: "2026-10-05", recurrence: "ONCE" }],
      taskStates: [{ taskId: "CUSTOM_REMINDER:reminder-current", snoozedUntil: "2026-10-06T07:00:00.000Z" }],
    });
    expect(deriveTasks(migrated, new Date(2026, 9, 5, 10)).find((task) => task.id === "CUSTOM_REMINDER:reminder-current")?.status).toBe("snoozed");
  });

  it.each([
    [1, schemaV1], [2, schemaV2], [3, schemaV3], [4, schemaV4],
  ])("round-trips schema %i through normalized load, save, and reload", async (_version, fixture) => {
    const values = new Map<string, string>([[RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(fixture)]]);
    storage.getItem.mockImplementation(async (key) => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { values.set(key, value); });

    const firstLoad = await loadRentalDocument();
    expect(firstLoad.schemaVersion).toBe(4);
    await saveRentalDocument(firstLoad);
    const afterFirstSave = await loadRentalDocument();
    expect(afterFirstSave).toEqual(firstLoad);
    await saveRentalDocument(afterFirstSave);
    await expect(loadRentalDocument()).resolves.toEqual(firstLoad);
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
    const current = schemaV4 as RentalDocument;
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    storage.setItem.mockResolvedValueOnce();
    await saveRentalDocument(current);
    storage.getItem.mockResolvedValueOnce(JSON.stringify(current));
    await expect(loadRentalDocument()).resolves.toEqual(current);
  });

  it("requires recurrence on schema 4 reminders", async () => {
    const current = structuredClone(schemaV4) as RentalDocument;
    delete (current.customReminders[0] as Partial<(typeof current.customReminders)[number]>).recurrence;
    storage.getItem.mockResolvedValueOnce(JSON.stringify(current));
    await expect(loadRentalDocument()).rejects.toMatchObject({ code: "CORRUPTED_DATA" });
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
      JSON.stringify({ ...validDocument, schemaVersion: 5 }),
    );

    await expect(loadRentalDocument()).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    } satisfies Partial<RentalStoreError>);
  });

  it("does not recover an older backup over a newer unsupported primary schema", async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify({ ...validDocument, schemaVersion: 5 })).mockResolvedValueOnce(JSON.stringify(validDocument));
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
    ["agreement end date", (doc: RentalDocument) => { doc.properties[0]!.rentalEndDate = "2026-02-30"; }],
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

  it("accepts a correctly formatted quarterly tax period", async () => {
    const quarterly = structuredClone(validDocument);
    quarterly.taxPayments[0]!.period = "2026-Q4";
    storage.getItem.mockResolvedValueOnce(JSON.stringify(quarterly));
    await expect(loadRentalDocument()).resolves.toMatchObject({ taxPayments: [{ period: "2026-Q4" }] });
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
