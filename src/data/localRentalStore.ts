import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  BillPayment,
  CustomReminder,
  AdministrationSuggestion,
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
  isValidHttpsUrl,
  validateRentalDocumentShape,
} from "../domain/rentalValidation";
import { todayInPoland } from "../domain/ryczaltTax";

export const RENTAL_DOCUMENT_SCHEMA_VERSION = 7;
/** Stable namespace; the current document schema version is stored in its JSON. */
export const RENTAL_DOCUMENT_STORAGE_KEY = "pl.ryczalt.rental.localDocument.v1";
export const RENTAL_DOCUMENT_BACKUP_KEY = `${RENTAL_DOCUMENT_STORAGE_KEY}.prev`;
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
  administrationSuggestions: [],
  customReminders: [],
  taskStates: [],
  settings: {
    taxYear,
    settlementMode: "monthly",
    jointSpouseThreshold: false,
    quarterlyEligible: false,
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
  if (![1, 2, 3, 4, 5, 6, RENTAL_DOCUMENT_SCHEMA_VERSION].includes(data.schemaVersion as number)) {
    throw new RentalStoreError(
      "UNSUPPORTED_VERSION",
      "Local rental document schema version is not supported.",
    );
  }
  const schemaVersion = data.schemaVersion as number;
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
  const reminderCategories = validateReminderCategories(settings.reminderCategories, schemaVersion < RENTAL_DOCUMENT_SCHEMA_VERSION ? data.properties : undefined);
  const rentReminderDelayDays = settings.rentReminderDelayDays === undefined && data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION
    ? 1
    : typeof settings.rentReminderDelayDays === "number" ? settings.rentReminderDelayDays : NaN;
  if (
    (settlementMode !== "monthly" && settlementMode !== "quarterly") ||
    typeof jointSpouseThreshold !== "boolean" ||
    typeof quarterlyEligible !== "boolean" || !Number.isInteger(rentReminderDelayDays) || rentReminderDelayDays < 0 || rentReminderDelayDays > 30
  ) throw corrupted("Local tax settings are invalid.");
  for (const field of ["openingTaxableRevenue", "openingTaxPaid"] as const) {
    if (settings[field] !== undefined && !optionalDecimal(settings[field], field)) throw corrupted("Opening tax balance is invalid.");
  }
  if (settlementMode === "quarterly" && !quarterlyEligible)
    throw corrupted("Quarterly settlement requires confirmed eligibility.");

  const legacyPropertyLinks = Array.isArray(data.propertyLinks) ? data.propertyLinks : [];
  const properties = validateArray(
    data.properties,
    (property) => validateProperty(property, data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION, legacyPropertyLinks),
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
  const savedAdministrationSuggestions = data.schemaVersion === RENTAL_DOCUMENT_SCHEMA_VERSION && data.administrationSuggestions !== undefined
    ? validateArray(data.administrationSuggestions, validateAdministrationSuggestion, "administrationSuggestions")
    : [];
  const administrationSuggestions = mergeAdministrationSuggestions(savedAdministrationSuggestions, properties);
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
      administrationSuggestions,
      customReminders,
      taskStates,
      settings: {
        taxYear, settlementMode, jointSpouseThreshold, quarterlyEligible, reminderCategories, rentReminderDelayDays,
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

function validateProperty(value: unknown, migrateLegacy = false, legacyLinks: unknown[] = []): Property {
  if (!isRecord(value) || !isStableId(value.id)) throw corrupted("Property entry is invalid.");
  const address = isNonEmptyString(value.address) ? value.address : migrateLegacy && isNonEmptyString(value.name) ? value.name : undefined;
  if (!address) throw corrupted("Property entry is invalid.");
  const administrationLink = migrateLegacy ? legacyLinks.find((link) => isRecord(link) && link.propertyId === value.id && link.category === "ADMINISTRATION") : undefined;
  const electricityLink = migrateLegacy ? legacyLinks.find((link) => isRecord(link) && link.propertyId === value.id && link.category === "UTILITY" && isLikelyElectricityProvider(link.label)) : undefined;
  const ownerRentValue = migrateLegacy && value.ownerRent === undefined ? value.defaultMonthlyRent : value.ownerRent;
  const mediaAmountValue = migrateLegacy && value.mediaAmount === undefined ? "0.00" : value.mediaAmount;
  const leaseEndDateValue = migrateLegacy ? value.leaseEndDate ?? value.rentalEndDate : value.leaseEndDate;
  const paymentDayValue = migrateLegacy ? value.paymentDay ?? value.expectedPaymentDay : value.paymentDay;
  const lifecycle = value.lifecycle ?? "ACTIVE";
  const rentalStartDate = optionalString(value.rentalStartDate) ? value.rentalStartDate : undefined;
  const administrationNameValue = migrateLegacy ? value.administrationName ?? (isRecord(administrationLink) ? administrationLink.label : undefined) : value.administrationName;
  const administrationUrlValue = migrateLegacy ? value.administrationUrl ?? value.administratorPortalUrl ?? (isRecord(administrationLink) ? administrationLink.url : undefined) : value.administrationUrl;
  const electricityProviderValue = migrateLegacy ? value.electricityProvider ?? (isRecord(electricityLink) ? electricityLink.label : undefined) : value.electricityProvider;
  const electricityUrlValue = migrateLegacy ? value.electricityUrl ?? (isRecord(electricityLink) ? electricityLink.url : undefined) : value.electricityUrl;
  const ownerRent = optionalDecimal(ownerRentValue, "ownerRent") ? ownerRentValue : undefined;
  const mediaAmount = optionalDecimal(mediaAmountValue, "mediaAmount") ? mediaAmountValue : undefined;
  const leaseEndDate = optionalString(leaseEndDateValue) ? leaseEndDateValue : undefined;
  const paymentDay = optionalNumber(paymentDayValue) ? paymentDayValue : undefined;
  const administrationName = optionalString(administrationNameValue) ? administrationNameValue : undefined;
  const administrationUrl = optionalString(administrationUrlValue) ? administrationUrlValue : undefined;
  const electricityProvider = optionalString(electricityProviderValue) ? electricityProviderValue : undefined;
  const electricityUrl = optionalString(electricityUrlValue) ? electricityUrlValue : undefined;
  const notes = migratedPropertyNotes(value, address);
  const taxableTreatment = value.taxableTreatment === "OWNER_RENT" || value.taxableTreatment === "RENT_AND_CHARGES" ? value.taxableTreatment : undefined;
  return {
    id: value.id,
    address,
    lifecycle: lifecycle as Property["lifecycle"],
    ...(rentalStartDate ? { rentalStartDate } : {}),
    ...(ownerRent !== undefined ? { ownerRent } : {}),
    ...(value.rentSchedule === undefined ? {} : { rentSchedule: validateArray(value.rentSchedule, validateRentRate, "rentSchedule") }),
    ...(mediaAmount !== undefined ? { mediaAmount } : {}),
    mediaPaidByTenant: optionalBoolean(value.mediaPaidByTenant) ? value.mediaPaidByTenant : false,
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
    ...(optionalString(value.tenantSince)
      ? { tenantSince: value.tenantSince }
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

function migratedPropertyNotes(value: Record<string, unknown>, address: string): string | undefined {
  const parts = [optionalString(value.notes) ? value.notes.trim() : ""];
  if (typeof value.name === "string" && value.name.trim() && value.name.trim() !== address.trim()) parts.push(`Dawna nazwa mieszkania: ${value.name.trim()}`);
  const administration = [
    typeof value.administratorPhone === "string" && value.administratorPhone.trim() ? `tel. ${value.administratorPhone.trim()}` : "",
    typeof value.administratorEmail === "string" && value.administratorEmail.trim() ? `e-mail ${value.administratorEmail.trim()}` : "",
  ].filter(Boolean);
  if (administration.length) parts.push(`Dawne dane administracji: ${administration.join(", ")}`);
  if (Array.isArray(value.rentalEndReminderDays) && value.rentalEndReminderDays.length && value.rentalEndReminderDays.every((day) => typeof day === "number" && Number.isInteger(day))) {
    parts.push(`Dawne terminy przypomnienia o końcu umowy: ${value.rentalEndReminderDays.join(", ")} dni (bieżące przypomnienie jest ustawione na 30 dni).`);
  }
  const unique = parts.filter((part, index) => part && parts.indexOf(part) === index);
  return unique.length ? unique.join("\n") : undefined;
}

function validateAdministrationSuggestion(value: unknown): AdministrationSuggestion {
  if (!isRecord(value) || !isNonEmptyString(value.name) || (value.url !== undefined && (!isNonEmptyString(value.url) || !isValidHttpsUrl(value.url)))) throw corrupted("Administration suggestion is invalid.");
  return { name: value.name, ...(optionalString(value.url) ? { url: value.url } : {}) };
}

function mergeAdministrationSuggestions(existing: AdministrationSuggestion[], properties: Property[]): AdministrationSuggestion[] {
  const byName = new Map<string, AdministrationSuggestion>();
  for (const value of [...existing, ...properties.flatMap((property) => property.administrationName ? [{ name: property.administrationName, ...(property.administrationUrl ? { url: property.administrationUrl } : {}) }] : [])]) {
    const key = value.name.trim().toLocaleLowerCase("pl-PL");
    if (key) byName.set(key, { name: value.name.trim(), ...(value.url ? { url: value.url } : byName.get(key)?.url ? { url: byName.get(key)!.url } : {}) });
  }
  return [...byName.values()];
}

function isLikelyElectricityProvider(value: unknown): boolean {
  return typeof value === "string" && /tauron|pge|enea|energa|e\.on/i.test(value);
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

function validateReminderCategories(value: unknown, legacyProperties?: unknown): RentalDocument["settings"]["reminderCategories"] {
  if (legacyProperties !== undefined && Array.isArray(legacyProperties) && legacyProperties.some((property) => isRecord(property) && "paymentReminderEnabled" in property)) {
    // A global category cannot preserve mixed per-apartment choices, so migrate conservatively.
    const rentEnabled = legacyProperties.length > 0 && legacyProperties.every((property) => isRecord(property) && property.paymentReminderEnabled === true);
    const rest = isRecord(value) ? value : {};
    return { rent: rentEnabled, agreements: typeof rest.agreements === "boolean" ? rest.agreements : true, tax: typeof rest.tax === "boolean" ? rest.tax : true, bills: typeof rest.bills === "boolean" ? rest.bills : true, custom: typeof rest.custom === "boolean" ? rest.custom : true };
  }
  if (value === undefined) return { rent: legacyProperties === undefined, agreements: true, tax: true, bills: true, custom: true };
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
