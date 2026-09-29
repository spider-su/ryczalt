import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  BillPayment,
  ApartmentPeriodSnapshot,
  CustomReminder,
  AdministrationSuggestion,
  IncomeEntry,
  Property,
  RecurringBill,
  RentalDocument,
  TaxPayment,
  TaxSettlementSnapshot,
  TaskState,
} from "../model/rental";
import {
  RentalValidationError,
  isValidCalendarDate,
  isValidHttpsUrl,
  validateRentalDocumentShape,
} from "../domain/rentalValidation";
import { todayInPoland } from "../domain/ryczaltTax";

export const RENTAL_DOCUMENT_SCHEMA_VERSION = 1;
/** Stable namespace; the current document schema version is stored in its JSON. */
export const RENTAL_DOCUMENT_STORAGE_KEY = "pl.ryczalt.rental.localDocument.v2";
export const RENTAL_DOCUMENT_BACKUP_KEY = `${RENTAL_DOCUMENT_STORAGE_KEY}.prev`;
export const LEGACY_RENTAL_DOCUMENT_STORAGE_KEY = "pl.ryczalt.rental.localDocument.v1";
export const LEGACY_RENTAL_DOCUMENT_BACKUP_KEY = `${LEGACY_RENTAL_DOCUMENT_STORAGE_KEY}.prev`;
export const DEFAULT_TAX_YEAR = Number(todayInPoland().slice(0, 4));

type RentalStoreErrorCode = "CORRUPTED_DATA" | "UNSUPPORTED_VERSION";

export class RentalStoreError extends Error {
  constructor(
    public readonly code: RentalStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RentalStoreError";
  }
}

export type RentalDocumentLoadResult = {
  document: RentalDocument;
  recoveredFromBackup: boolean;
};

export const RENTAL_BACKUP_FORMAT = "pl.ryczalt.rental.backup";
export const RENTAL_BACKUP_VERSION = 1;

type RentalBackupEnvelope = {
  format: typeof RENTAL_BACKUP_FORMAT;
  backupVersion: typeof RENTAL_BACKUP_VERSION;
  exportedAt: string;
  document: RentalDocument;
};

export function createRentalBackup(document: RentalDocument, exportedAt = new Date().toISOString()): string {
  const validated = validateRentalDocument(document);
  const backup: RentalBackupEnvelope = {
    format: RENTAL_BACKUP_FORMAT,
    backupVersion: RENTAL_BACKUP_VERSION,
    exportedAt,
    document: validated,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseRentalBackup(raw: string): RentalDocument {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw corrupted("Backup file is not valid JSON.");
  }
  if (!isRecord(data) || data.format !== RENTAL_BACKUP_FORMAT || data.backupVersion !== RENTAL_BACKUP_VERSION) {
    throw new RentalStoreError("UNSUPPORTED_VERSION", "Backup format or version is not supported.");
  }
  if (!isValidIsoTimestamp(data.exportedAt)) throw corrupted("Backup export timestamp is invalid.");
  return validateRentalDocument(data.document);
}

export const emptyDocument = (
  taxYear = DEFAULT_TAX_YEAR,
): RentalDocument => ({
  schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
  properties: [],
  incomeEntries: [],
  taxPayments: [],
  recurringBills: [],
  billPayments: [],
  administrationSuggestions: [],
  customReminders: [],
  taskStates: [],
  apartmentPeriods: [],
  taxSettlementSnapshots: [],
  settings: {
    taxYear,
    settlementMode: "monthly",
    jointSpouseThreshold: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true },
    rentReminderDelayDays: 1,
  },
});

export async function loadRentalDocument(): Promise<RentalDocument> {
  return (await loadRentalDocumentWithStatus()).document;
}

export async function loadRentalDocumentWithStatus(): Promise<RentalDocumentLoadResult> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(RENTAL_DOCUMENT_STORAGE_KEY);
  } catch (primaryReadError) {
    return recoverFromBackup(primaryReadError);
  }
  if (raw === null) {
    const backupRaw = await AsyncStorage.getItem(RENTAL_DOCUMENT_BACKUP_KEY);
    if (backupRaw !== null) return { document: parseRentalDocument(backupRaw), recoveredFromBackup: true };

    // One-time namespace migration. Only a legacy document that validates against the
    // current schema is copied; incompatible historical v1 bytes are left untouched.
    const legacyRaw = await AsyncStorage.getItem(LEGACY_RENTAL_DOCUMENT_STORAGE_KEY);
    if (legacyRaw !== null) {
      try {
        const legacyDocument = parseRentalDocument(legacyRaw);
        await AsyncStorage.setItem(RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(legacyDocument));
        return { document: legacyDocument, recoveredFromBackup: false };
      } catch {
        // Never classify an older namespace as corrupted current data and never delete it.
      }
    }
    return { document: emptyDocument(), recoveredFromBackup: false };
  }
  try {
    return { document: parseRentalDocument(raw), recoveredFromBackup: false };
  } catch (primaryError) {
    if (primaryError instanceof RentalStoreError && primaryError.code === "UNSUPPORTED_VERSION") throw primaryError;
    return recoverFromBackup(primaryError);
  }
}

export async function saveRentalDocument(
  document: RentalDocument,
): Promise<void> {
  const next = JSON.stringify(validateRentalDocument(document));
  const currentRaw = await AsyncStorage.getItem(RENTAL_DOCUMENT_STORAGE_KEY);
  if (currentRaw !== null) {
    try {
      const lastGood = parseRentalDocument(currentRaw);
      await AsyncStorage.setItem(RENTAL_DOCUMENT_BACKUP_KEY, JSON.stringify(lastGood));
    } catch (error) {
      if (!(error instanceof RentalStoreError) || error.code === "UNSUPPORTED_VERSION") throw error;
      // Never copy corrupted bytes into the backup; a valid existing backup remains untouched.
    }
  }
  await AsyncStorage.setItem(RENTAL_DOCUMENT_STORAGE_KEY, next);
}

export async function readRawRentalDocument(): Promise<string | null> {
  return AsyncStorage.getItem(RENTAL_DOCUMENT_STORAGE_KEY);
}

/** Removes unreadable local data only after the user confirms an explicit reset. */
export async function resetRentalDocument(): Promise<void> {
  await AsyncStorage.removeItem(RENTAL_DOCUMENT_BACKUP_KEY);
  await AsyncStorage.removeItem(RENTAL_DOCUMENT_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_RENTAL_DOCUMENT_BACKUP_KEY);
  await AsyncStorage.removeItem(LEGACY_RENTAL_DOCUMENT_STORAGE_KEY);
}

function parseRentalDocument(raw: string): RentalDocument {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (_error) {
    throw new RentalStoreError("CORRUPTED_DATA", "Local rental document is not valid JSON.");
  }
  return validateRentalDocument(data);
}

async function recoverFromBackup(primaryError: unknown): Promise<RentalDocumentLoadResult> {
  let backupRaw: string | null;
  try {
    backupRaw = await AsyncStorage.getItem(RENTAL_DOCUMENT_BACKUP_KEY);
  } catch {
    throw primaryError;
  }
  if (backupRaw === null) throw primaryError;
  try {
    return { document: parseRentalDocument(backupRaw), recoveredFromBackup: true };
  } catch (backupError) {
    if (backupError instanceof RentalStoreError && backupError.code === "UNSUPPORTED_VERSION") throw backupError;
    throw primaryError;
  }
}

function validateRentalDocument(data: unknown): RentalDocument {
  if (!isRecord(data))
    throw corrupted("Local rental document must be a JSON object.");
  if (data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION) {
    throw new RentalStoreError(
      "UNSUPPORTED_VERSION",
      "Local rental document schema version is not supported.",
    );
  }
  const settings = data.settings;
  if (
    !isRecord(settings) ||
    typeof settings.taxYear !== "number" ||
    !Number.isInteger(settings.taxYear)
  ) {
    throw corrupted("Local rental settings are invalid.");
  }
  const taxYear = settings.taxYear;
  const settlementMode = settings.settlementMode;
  const jointSpouseThreshold = settings.jointSpouseThreshold;
  const reminderCategories = validateReminderCategories(settings.reminderCategories);
  const rentReminderDelayDays = typeof settings.rentReminderDelayDays === "number" ? settings.rentReminderDelayDays : NaN;
  if (
    settlementMode !== "monthly" ||
    typeof jointSpouseThreshold !== "boolean" ||
    !Number.isInteger(rentReminderDelayDays) || rentReminderDelayDays < 0 || rentReminderDelayDays > 30
  ) throw corrupted("Local tax settings are invalid.");
  for (const field of ["openingTaxableRevenue", "openingTaxPaid"] as const) {
    if (settings[field] !== undefined && !optionalDecimal(settings[field], field)) throw corrupted("Opening tax balance is invalid.");
  }

  const properties = validateArray(data.properties, validateProperty, "properties");
  const incomeEntries = validateArray(
    data.incomeEntries,
    validateIncomeEntry,
    "incomeEntries",
  );
  const taxPayments = validateArray(
    data.taxPayments,
    validateTaxPayment,
    "taxPayments",
  );
  const recurringBills = validateArray(data.recurringBills, validateRecurringBill, "recurringBills");
  const billPayments = validateArray(data.billPayments, validateBillPayment, "billPayments");
  const administrationSuggestions = validateArray(data.administrationSuggestions, validateAdministrationSuggestion, "administrationSuggestions");
  const customReminders = validateArray(data.customReminders, validateCustomReminder, "customReminders");
  const taskStates = validateArray(data.taskStates, validateTaskState, "taskStates");
  const apartmentPeriods = validateArray(data.apartmentPeriods, validateApartmentPeriod, "apartmentPeriods");
  const taxSettlementSnapshots = validateArray(data.taxSettlementSnapshots, validateTaxSettlementSnapshot, "taxSettlementSnapshots");

  try {
    return validateRentalDocumentShape({
      schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
      properties,
      incomeEntries,
      taxPayments,
      recurringBills,
      billPayments,
      administrationSuggestions,
      customReminders,
      taskStates,
      apartmentPeriods,
      taxSettlementSnapshots,
      settings: {
        taxYear, settlementMode, jointSpouseThreshold, reminderCategories, rentReminderDelayDays,
        ...(optionalString(settings.taxRecipientName) ? { taxRecipientName: settings.taxRecipientName } : {}),
        ...(optionalString(settings.taxMicroAccount) ? { taxMicroAccount: settings.taxMicroAccount } : {}),
        ...(optionalDecimal(settings.openingTaxableRevenue, "openingTaxableRevenue") ? { openingTaxableRevenue: settings.openingTaxableRevenue } : {}),
        ...(optionalDecimal(settings.openingTaxPaid, "openingTaxPaid") ? { openingTaxPaid: settings.openingTaxPaid } : {}),
      },
    });
  } catch (error) {
    if (error instanceof RentalValidationError) throw corrupted(error.message);
    throw error;
  }
}

function validateProperty(value: unknown): Property {
  if (!isRecord(value) || !isStableId(value.id)) throw corrupted("Property entry is invalid.");
  if (!isNonEmptyString(value.address) || !["ACTIVE", "PAUSED", "ARCHIVED"].includes(value.lifecycle as string) || !isDecimalString(value.mediaAmount) || typeof value.mediaPaidByTenant !== "boolean") throw corrupted("Property entry is invalid.");
  const address = value.address;
  const lifecycle = value.lifecycle;
  const rentalStartDate = optionalString(value.rentalStartDate) ? value.rentalStartDate : undefined;
  const ownerRent = optionalDecimal(value.ownerRent, "ownerRent") ? value.ownerRent : undefined;
  const mediaAmount = optionalDecimal(value.mediaAmount, "mediaAmount") ? value.mediaAmount : undefined;
  const leaseEndDate = optionalString(value.leaseEndDate) ? value.leaseEndDate : undefined;
  const paymentDay = optionalNumber(value.paymentDay) ? value.paymentDay : undefined;
  const administrationName = optionalString(value.administrationName) ? value.administrationName : undefined;
  const administrationUrl = optionalString(value.administrationUrl) ? value.administrationUrl : undefined;
  const electricityProvider = optionalString(value.electricityProvider) ? value.electricityProvider : undefined;
  const electricityUrl = optionalString(value.electricityUrl) ? value.electricityUrl : undefined;
  const notes = optionalString(value.notes) ? value.notes : undefined;
  const taxableTreatment = value.taxableTreatment === "OWNER_RENT" || value.taxableTreatment === "RENT_AND_CHARGES" ? value.taxableTreatment : undefined;
  const rentSchedule = value.rentSchedule === undefined ? undefined : validateArray(value.rentSchedule, validateRentRate, "rentSchedule");
  return {
    id: value.id,
    address,
    lifecycle: lifecycle as Property["lifecycle"],
    ...(rentalStartDate ? { rentalStartDate } : {}),
    ...(ownerRent !== undefined ? { ownerRent } : {}),
    ...(rentSchedule ? { rentSchedule } : {}),
    ...(value.lifecycleSchedule === undefined ? {} : { lifecycleSchedule: validateArray(value.lifecycleSchedule, validateLifecycleRate, "lifecycleSchedule") }),
    ...(mediaAmount !== undefined ? { mediaAmount } : {}),
    mediaPaidByTenant: value.mediaPaidByTenant,
    ...(taxableTreatment ? { taxableTreatment } : {}),
    ...(optionalString(value.tenantName)
      ? { tenantName: value.tenantName }
      : {}),
    ...(optionalString(value.tenantPhone)
      ? { tenantPhone: value.tenantPhone }
      : {}),
    ...(optionalString(value.tenantEmail)
      ? { tenantEmail: value.tenantEmail }
      : {}),
    ...(leaseEndDate ? { leaseEndDate } : {}),
    ...(paymentDay !== undefined ? { paymentDay } : {}),
    ...(administrationName ? { administrationName } : {}),
    ...(administrationUrl ? { administrationUrl } : {}),
    ...(electricityProvider ? { electricityProvider } : {}),
    ...(electricityUrl ? { electricityUrl } : {}),
    ...(notes ? { notes } : {}),
  };
}

function validateAdministrationSuggestion(value: unknown): AdministrationSuggestion {
  if (!isRecord(value) || !isNonEmptyString(value.name) || (value.url !== undefined && (!isNonEmptyString(value.url) || !isValidHttpsUrl(value.url)))) throw corrupted("Administration suggestion is invalid.");
  return { name: value.name, ...(optionalString(value.url) ? { url: value.url } : {}) };
}

function validateRentRate(value: unknown): NonNullable<Property["rentSchedule"]>[number] {
  if (!isRecord(value) || !isNonEmptyString(value.effectiveFrom) || !isDecimalString(value.amount) || !isDecimalString(value.mediaAmount) || typeof value.mediaPaidByTenant !== "boolean" || (value.taxableTreatment !== "OWNER_RENT" && value.taxableTreatment !== "RENT_AND_CHARGES") || !Number.isInteger(value.paymentDay) || (value.paymentDay as number) < 1 || (value.paymentDay as number) > 31) throw corrupted("Rent rate entry is invalid.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.effectiveFrom)) throw corrupted("Rent rate entry is invalid.");
  return { effectiveFrom: value.effectiveFrom, amount: value.amount, mediaAmount: value.mediaAmount, mediaPaidByTenant: value.mediaPaidByTenant, taxableTreatment: value.taxableTreatment, paymentDay: value.paymentDay as number };
}

function validateLifecycleRate(value: unknown): NonNullable<Property["lifecycleSchedule"]>[number] {
  if (!isRecord(value) || typeof value.effectiveFrom !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.effectiveFrom) || !["ACTIVE", "PAUSED", "ARCHIVED"].includes(value.lifecycle as string)) throw corrupted("Apartment lifecycle history is invalid.");
  return { effectiveFrom: value.effectiveFrom, lifecycle: value.lifecycle as "ACTIVE" | "PAUSED" | "ARCHIVED" };
}

function validateApartmentPeriod(value: unknown): ApartmentPeriodSnapshot {
  if (!isRecord(value) || !isStableId(value.propertyId) || typeof value.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) || (value.ownerRent !== undefined && !isDecimalString(value.ownerRent)) || (value.expectedAmount !== undefined && !isDecimalString(value.expectedAmount)) || typeof value.expectedKnown !== "boolean" || !isDecimalString(value.confirmedAmount) || !isDecimalString(value.taxableAmount) || !Array.isArray(value.receiptIds) || !value.receiptIds.every(isStableId) || !isValidIsoTimestamp(value.closedAt)) throw corrupted("Apartment period snapshot is invalid.");
  return { propertyId: value.propertyId, month: value.month, ...(typeof value.ownerRent === "string" ? { ownerRent: value.ownerRent } : {}), ...(typeof value.expectedAmount === "string" ? { expectedAmount: value.expectedAmount } : {}), expectedKnown: value.expectedKnown, confirmedAmount: value.confirmedAmount, taxableAmount: value.taxableAmount, receiptIds: value.receiptIds, closedAt: value.closedAt };
}

function validateTaxSettlementSnapshot(value: unknown): TaxSettlementSnapshot {
  if (!isRecord(value) || typeof value.period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.period) || !["revenue", "taxableBase", "cumulativeRevenue", "cumulativeTax", "obligation", "paid", "allocatedPaid", "creditApplied", "outstanding", "overpaid"].every((key) => isDecimalString(value[key])) || typeof value.dueDate !== "string" || !isValidCalendarDate(value.dueDate) || !Number.isInteger(value.rulesYear) || !Array.isArray(value.receiptIds) || !value.receiptIds.every(isStableId) || !Array.isArray(value.taxPaymentIds) || !value.taxPaymentIds.every(isStableId) || !isValidIsoTimestamp(value.savedAt)) throw corrupted("Tax settlement snapshot is invalid.");
  return { period: value.period, revenue: value.revenue as string, taxableBase: value.taxableBase as string, cumulativeRevenue: value.cumulativeRevenue as string, cumulativeTax: value.cumulativeTax as string, obligation: value.obligation as string, paid: value.paid as string, allocatedPaid: value.allocatedPaid as string, creditApplied: value.creditApplied as string, outstanding: value.outstanding as string, overpaid: value.overpaid as string, dueDate: value.dueDate as string, rulesYear: value.rulesYear as number, receiptIds: value.receiptIds, taxPaymentIds: value.taxPaymentIds, savedAt: value.savedAt as string };
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
}

function validateCustomReminder(value: unknown): CustomReminder {
  if (!isRecord(value) || !isStableId(value.id) || !isNonEmptyString(value.title) || !isNonEmptyString(value.dueDate)) throw corrupted("Custom reminder entry is invalid.");
  const recurrence = value.recurrence;
  if (recurrence !== "ONCE" && recurrence !== "MONTHLY" && recurrence !== "YEARLY") throw corrupted("Custom reminder recurrence is invalid.");
  return { id: value.id, title: value.title, dueDate: value.dueDate, recurrence, ...(optionalString(value.propertyId) ? { propertyId: value.propertyId } : {}), ...(optionalString(value.note) ? { note: value.note } : {}) };
}

function validateTaskState(value: unknown): TaskState {
  if (!isRecord(value) || !isNonEmptyString(value.taskId)) throw corrupted("Task state entry is invalid.");
  return { taskId: value.taskId, ...(optionalString(value.snoozedUntil) ? { snoozedUntil: value.snoozedUntil } : {}), ...(optionalString(value.dismissedAt) ? { dismissedAt: value.dismissedAt } : {}), ...(optionalString(value.completedAt) ? { completedAt: value.completedAt } : {}) };
}

function validateRecurringBill(value: unknown): RecurringBill {
  if (!isRecord(value) || !isStableId(value.id) || !isStableId(value.propertyId) || !isNonEmptyString(value.name) || typeof value.reminderEnabled !== "boolean")
    throw corrupted("Recurring bill entry is invalid.");
  return {
    id: value.id, propertyId: value.propertyId, name: value.name, reminderEnabled: value.reminderEnabled,
    ...(optionalString(value.recipientName) ? { recipientName: value.recipientName } : {}),
    ...(optionalString(value.bankAccount) ? { bankAccount: value.bankAccount } : {}),
    ...(optionalString(value.paymentTitle) ? { paymentTitle: value.paymentTitle } : {}),
    ...(optionalDecimal(value.expectedAmount, "expectedAmount") ? { expectedAmount: value.expectedAmount } : {}),
    ...(optionalNumber(value.dueDay) ? { dueDay: value.dueDay } : {}),
    ...(optionalBoolean(value.variableAmount) ? { variableAmount: value.variableAmount } : {}),
  };
}

function validateBillPayment(value: unknown): BillPayment {
  if (!isRecord(value) || !isStableId(value.id) || !isStableId(value.billId) || !isNonEmptyString(value.period) || !isNonEmptyString(value.paidAt) || !isDecimalString(value.amount))
    throw corrupted("Bill payment entry is invalid.");
  return { id: value.id, billId: value.billId, period: value.period, paidAt: value.paidAt, amount: value.amount };
}

function validateReminderCategories(value: unknown): RentalDocument["settings"]["reminderCategories"] {
  if (!isRecord(value)) throw corrupted("Notification settings are invalid.");
  const categories = { rent: value.rent, agreements: value.agreements, tax: value.tax, bills: value.bills, custom: value.custom };
  if (Object.values(categories).some((enabled) => typeof enabled !== "boolean")) throw corrupted("Notification settings are invalid.");
  return categories as RentalDocument["settings"]["reminderCategories"];
}

function validateIncomeEntry(value: unknown): IncomeEntry {
  if (
    !isRecord(value) ||
    !isStableId(value.id) ||
    !isStableId(value.propertyId) ||
    !isNonEmptyString(value.receivedAt) ||
    !isDecimalString(value.amount) ||
    !isDecimalString(value.taxableAmount)
  ) {
    throw corrupted("Income entry is invalid.");
  }
  return {
    id: value.id,
    propertyId: value.propertyId,
    receivedAt: value.receivedAt,
    amount: value.amount,
    taxableAmount: value.taxableAmount,
    ...(optionalString(value.rentalMonth)
      ? { rentalMonth: value.rentalMonth }
      : {}),
    ...(optionalString(value.tenantNameSnapshot)
      ? { tenantNameSnapshot: value.tenantNameSnapshot }
      : {}),
    ...(optionalString(value.description)
      ? { description: value.description }
      : {}),
    ...(value.source === "MANUAL" || value.source === "INITIAL_IMPORT" ? { source: value.source } : {}),
  };
}

function validateTaxPayment(value: unknown): TaxPayment {
  if (
    !isRecord(value) ||
    !isStableId(value.id) ||
    !isNonEmptyString(value.period) ||
    !isNonEmptyString(value.paidAt) ||
    !isDecimalString(value.amount)
  ) {
    throw corrupted("Tax payment entry is invalid.");
  }
  return {
    id: value.id,
    period: value.period,
    paidAt: value.paidAt,
    amount: value.amount,
    ...(value.source === "MANUAL" || value.source === "INITIAL_IMPORT" ? { source: value.source } : {}),
  };
}

function validateArray<T>(
  value: unknown,
  validate: (item: unknown) => T,
  name: string,
): T[] {
  if (!Array.isArray(value))
    throw corrupted(`Local rental document ${name} must be an array.`);
  return value.map(validate);
}

function optionalDecimal(value: unknown, field: string): value is string {
  if (value === undefined) return false;
  if (isDecimalString(value)) return true;
  throw corrupted(`Money field ${field} must be a decimal string.`);
}

function optionalString(value: unknown): value is string {
  if (value === undefined) return false;
  if (typeof value === "string") return true;
  throw corrupted("Optional text field must be a string.");
}

function optionalNumber(value: unknown): value is number {
  if (value === undefined) return false;
  if (typeof value === "number" && Number.isInteger(value)) return true;
  throw corrupted("Optional numeric field must be an integer.");
}

function optionalBoolean(value: unknown): value is boolean {
  if (value === undefined) return false;
  if (typeof value === "boolean") return true;
  throw corrupted("Optional boolean field must be true or false.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

function corrupted(message: string): RentalStoreError {
  return new RentalStoreError("CORRUPTED_DATA", message);
}
