import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  BillPayment,
  CustomReminder,
  IncomeEntry,
  Property,
  PropertyLink,
  RecurringBill,
  RentalDocument,
  TaxPayment,
  TaskState,
} from "../model/rental";
import {
  RentalValidationError,
  validateRentalDocumentShape,
} from "../domain/rentalValidation";
import { SUPPORTED_TAX_YEARS } from "../domain/ryczaltTax";

export const RENTAL_DOCUMENT_SCHEMA_VERSION = 4;
/** Stable namespace; the current document schema version is stored in its JSON. */
export const RENTAL_DOCUMENT_STORAGE_KEY = "pl.ryczalt.rental.localDocument.v1";
export const RENTAL_DOCUMENT_BACKUP_KEY = `${RENTAL_DOCUMENT_STORAGE_KEY}.prev`;
export const DEFAULT_TAX_YEAR = Math.max(...SUPPORTED_TAX_YEARS);

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

export const emptyDocument = (
  taxYear = DEFAULT_TAX_YEAR,
): RentalDocument => ({
  schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
  properties: [],
  incomeEntries: [],
  taxPayments: [],
  recurringBills: [],
  billPayments: [],
  propertyLinks: [],
  customReminders: [],
  taskStates: [],
  settings: {
    taxYear,
    settlementMode: "monthly",
    jointSpouseThreshold: false,
    quarterlyEligible: false,
    reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true },
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
    if (backupRaw === null) return { document: emptyDocument(), recoveredFromBackup: false };
    return { document: parseRentalDocument(backupRaw), recoveredFromBackup: true };
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
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2 && data.schemaVersion !== 3 && data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION) {
    throw new RentalStoreError(
      "UNSUPPORTED_VERSION",
      "Local rental document schema version is not supported.",
    );
  }
  const reminderRecurrenceIsLegacy = data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION;

  const settings = data.settings;
  if (
    !isRecord(settings) ||
    typeof settings.taxYear !== "number" ||
    !Number.isInteger(settings.taxYear)
  ) {
    throw corrupted("Local rental settings are invalid.");
  }
  const taxYear = settings.taxYear;
  const settlementMode = settings.settlementMode ?? "monthly";
  const jointSpouseThreshold = settings.jointSpouseThreshold ?? false;
  const quarterlyEligible = settings.quarterlyEligible ?? false;
  const reminderCategories = validateReminderCategories(settings.reminderCategories);
  if (
    (settlementMode !== "monthly" && settlementMode !== "quarterly") ||
    typeof jointSpouseThreshold !== "boolean" ||
    typeof quarterlyEligible !== "boolean"
  ) throw corrupted("Local tax settings are invalid.");
  if (settlementMode === "quarterly" && !quarterlyEligible)
    throw corrupted("Quarterly settlement requires confirmed eligibility.");

  const properties = validateArray(
    data.properties,
    validateProperty,
    "properties",
  );
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
  const recurringBills = data.recurringBills === undefined ? [] : validateArray(data.recurringBills, validateRecurringBill, "recurringBills");
  const billPayments = data.billPayments === undefined ? [] : validateArray(data.billPayments, validateBillPayment, "billPayments");
  const propertyLinks = data.propertyLinks === undefined ? [] : validateArray(data.propertyLinks, validatePropertyLink, "propertyLinks");
  const customReminders = migrateCustomReminders(data.customReminders, reminderRecurrenceIsLegacy);
  const taskStates = data.taskStates === undefined ? [] : validateArray(data.taskStates, validateTaskState, "taskStates");

  try {
    return validateRentalDocumentShape({
      schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
      properties,
      incomeEntries,
      taxPayments,
      recurringBills,
      billPayments,
      propertyLinks,
      customReminders,
      taskStates,
      settings: {
        taxYear, settlementMode, jointSpouseThreshold, quarterlyEligible, reminderCategories,
        ...(optionalString(settings.taxRecipientName) ? { taxRecipientName: settings.taxRecipientName } : {}),
        ...(optionalString(settings.taxMicroAccount) ? { taxMicroAccount: settings.taxMicroAccount } : {}),
      },
    });
  } catch (error) {
    if (error instanceof RentalValidationError) throw corrupted(error.message);
    throw error;
  }
}

function validateProperty(value: unknown): Property {
  if (
    !isRecord(value) ||
    !isStableId(value.id) ||
    !isNonEmptyString(value.name)
  )
    throw corrupted("Property entry is invalid.");
  return {
    id: value.id,
    name: value.name,
    ...(optionalString(value.address) ? { address: value.address } : {}),
    ...(optionalDecimal(value.defaultMonthlyRent, "defaultMonthlyRent")
      ? { defaultMonthlyRent: value.defaultMonthlyRent }
      : {}),
    ...(value.rentSchedule === undefined ? {} : { rentSchedule: validateArray(value.rentSchedule, validateRentRate, "rentSchedule") }),
    ...(optionalString(value.tenantName)
      ? { tenantName: value.tenantName }
      : {}),
    ...(optionalString(value.tenantPhone)
      ? { tenantPhone: value.tenantPhone }
      : {}),
    ...(optionalString(value.tenantEmail)
      ? { tenantEmail: value.tenantEmail }
      : {}),
    ...(optionalString(value.tenantSince)
      ? { tenantSince: value.tenantSince }
      : {}),
    ...(optionalString(value.rentalEndDate) ? { rentalEndDate: value.rentalEndDate } : {}),
    ...(optionalNumberArray(value.rentalEndReminderDays) ? { rentalEndReminderDays: value.rentalEndReminderDays } : {}),
    ...(optionalNumber(value.expectedPaymentDay) ? { expectedPaymentDay: value.expectedPaymentDay } : {}),
    ...(optionalBoolean(value.paymentReminderEnabled) ? { paymentReminderEnabled: value.paymentReminderEnabled } : {}),
    ...(optionalNumber(value.paymentReminderDelayDays) ? { paymentReminderDelayDays: value.paymentReminderDelayDays } : {}),
    ...(optionalString(value.administratorName) ? { administratorName: value.administratorName } : {}),
    ...(optionalString(value.administratorPortalUrl) ? { administratorPortalUrl: value.administratorPortalUrl } : {}),
    ...(optionalString(value.administratorPhone) ? { administratorPhone: value.administratorPhone } : {}),
    ...(optionalString(value.administratorEmail) ? { administratorEmail: value.administratorEmail } : {}),
    ...(optionalString(value.notes) ? { notes: value.notes } : {}),
  };
}

function validateRentRate(value: unknown): { effectiveFrom: string; amount: string } {
  if (!isRecord(value) || !isNonEmptyString(value.effectiveFrom) || !isDecimalString(value.amount)) throw corrupted("Rent rate entry is invalid.");
  return { effectiveFrom: value.effectiveFrom, amount: value.amount };
}

function validatePropertyLink(value: unknown): PropertyLink {
  if (!isRecord(value) || !isStableId(value.id) || !isStableId(value.propertyId) || !isNonEmptyString(value.label) || !isNonEmptyString(value.url)) throw corrupted("Property link entry is invalid.");
  return { id: value.id, propertyId: value.propertyId, label: value.label, url: value.url, ...(optionalString(value.category) ? { category: value.category as PropertyLink["category"] } : {}) };
}

function validateCustomReminder(value: unknown, migrateMissingRecurrence = false): CustomReminder {
  if (!isRecord(value) || !isStableId(value.id) || !isNonEmptyString(value.title) || !isNonEmptyString(value.dueDate)) throw corrupted("Custom reminder entry is invalid.");
  const recurrence = value.recurrence ?? (migrateMissingRecurrence ? "ONCE" : undefined);
  if (recurrence !== "ONCE" && recurrence !== "MONTHLY" && recurrence !== "YEARLY") throw corrupted("Custom reminder recurrence is invalid.");
  return { id: value.id, title: value.title, dueDate: value.dueDate, recurrence, ...(optionalString(value.propertyId) ? { propertyId: value.propertyId } : {}), ...(optionalString(value.note) ? { note: value.note } : {}) };
}

/** Legacy reminder records in schemas 1–3 lacked recurrence and mean ONCE. */
function migrateCustomReminders(value: unknown, legacySchema: boolean): CustomReminder[] {
  if (value === undefined) return [];
  return validateArray(value, (reminder) => validateCustomReminder(reminder, legacySchema), "customReminders");
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
  if (value === undefined) return { rent: true, agreements: true, tax: true, bills: true, custom: true };
  if (!isRecord(value)) throw corrupted("Notification settings are invalid.");
  const categories = { rent: value.rent, agreements: value.agreements, tax: value.tax, bills: value.bills, custom: value.custom ?? true };
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

function optionalNumberArray(value: unknown): value is number[] {
  if (value === undefined) return false;
  if (Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isInteger(item))) return true;
  throw corrupted("Reminder day list is invalid.");
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
