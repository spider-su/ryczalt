import type { IncomeEntry, Property, RentalDocument } from "../model/rental";

export const RENTAL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export class RentalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RentalValidationError";
  }
}

export function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parts = value.split("-").map(Number);
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isRentalMonth(value: string): boolean {
  return RENTAL_MONTH_PATTERN.test(value);
}

export function isDecimalString(value: string): boolean {
  if (!DECIMAL_PATTERN.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")) <= BigInt(Number.MAX_SAFE_INTEGER);
}

export function isPositiveMoney(value: string): boolean {
  return isDecimalString(value) && compareDecimalStrings(value, "0") > 0;
}

export function isNonnegativeMoney(value: string): boolean {
  return isDecimalString(value) && compareDecimalStrings(value, "0") >= 0;
}

export function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isValidPolishBankAccount(value: string): boolean {
  const normalized = value.replace(/\s/g, "").toUpperCase();
  const iban = normalized.startsWith("PL") ? normalized : `PL${normalized}`;
  if (!/^PL\d{26}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}2521${iban.slice(2, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidTaxMicroAccount(value: string): boolean {
  return /^\d{26}$/.test(value) && isValidPolishBankAccount(value);
}

/** Exact decimal comparison; no JavaScript floating-point arithmetic is used. */
export function compareDecimalStrings(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const leftWhole = leftParts[0]!;
  const leftFraction = leftParts[1] ?? "";
  const rightWhole = rightParts[0]!;
  const rightFraction = rightParts[1] ?? "";
  const wholeComparison =
    leftWhole.length - rightWhole.length || leftWhole.localeCompare(rightWhole);
  if (wholeComparison !== 0) return wholeComparison > 0 ? 1 : -1;
  const fractionComparison = leftFraction
    .padEnd(2, "0")
    .localeCompare(rightFraction.padEnd(2, "0"));
  return fractionComparison === 0 ? 0 : fractionComparison > 0 ? 1 : -1;
}

export function assertPropertyReference(
  properties: Property[],
  propertyId: string,
): void {
  if (!properties.some((property) => property.id === propertyId)) {
    throw new RentalValidationError(
      "Income entry refers to an unknown property.",
    );
  }
}

export function validateIncomeValues(
  input: Pick<
    IncomeEntry,
    "receivedAt" | "amount" | "taxableAmount" | "propertyId"
  >,
  properties: Property[],
): void {
  assertPropertyReference(properties, input.propertyId);
  if (!isValidCalendarDate(input.receivedAt))
    throw new RentalValidationError(
      "Received date is not a valid calendar date.",
    );
  if (!isPositiveMoney(input.amount))
    throw new RentalValidationError(
      "Received amount must be positive and have at most two decimals.",
    );
  if (!isNonnegativeMoney(input.taxableAmount))
    throw new RentalValidationError(
      "Taxable amount must be nonnegative and have at most two decimals.",
    );
  if (compareDecimalStrings(input.taxableAmount, input.amount) > 0) {
    throw new RentalValidationError(
      "Taxable amount cannot exceed the received amount.",
    );
  }
}

export function validateRentalDocumentShape(
  document: RentalDocument,
): RentalDocument {
  if (document.schemaVersion !== 1)
    throw new RentalValidationError(
      "Unsupported rental document schema version.",
    );
  if (document.settings.taxYear < 2025 || document.settings.taxYear > new Date().getFullYear())
    throw new RentalValidationError("Tax year is outside the available calendar range.");
  if (!Number.isInteger(document.settings.rentReminderDelayDays) || document.settings.rentReminderDelayDays < 0 || document.settings.rentReminderDelayDays > 30)
    throw new RentalValidationError("Rent reminder delay is invalid.");
  for (const amount of [document.settings.openingTaxableRevenue, document.settings.openingTaxPaid]) {
    if (amount !== undefined && !isNonnegativeMoney(amount)) throw new RentalValidationError("Opening tax balance is invalid.");
  }
  const propertyIds = new Set<string>();
  for (const property of document.properties) {
    if (propertyIds.has(property.id))
      throw new RentalValidationError("Property IDs must be unique.");
    propertyIds.add(property.id);
    if (!property.address.trim()) throw new RentalValidationError("Property address is required.");
    if (![undefined, "ACTIVE", "PAUSED", "ARCHIVED"].includes(property.lifecycle)) throw new RentalValidationError("Apartment lifecycle is invalid.");
    if (property.rentalStartDate && !isValidCalendarDate(property.rentalStartDate)) throw new RentalValidationError("Rental start date is invalid.");
    if (
      property.ownerRent &&
      !isNonnegativeMoney(property.ownerRent)
    )
      throw new RentalValidationError("Owner rent is invalid.");
    if (property.mediaAmount && !isNonnegativeMoney(property.mediaAmount)) throw new RentalValidationError("Media amount is invalid.");
    if (property.mediaPaidByTenant !== undefined && typeof property.mediaPaidByTenant !== "boolean") throw new RentalValidationError("Media payment responsibility is invalid.");
    if (property.taxableTreatment !== undefined && property.taxableTreatment !== "OWNER_RENT" && property.taxableTreatment !== "RENT_AND_CHARGES") throw new RentalValidationError("Taxable rent treatment is invalid.");
    if (property.leaseEndDate && !isValidCalendarDate(property.leaseEndDate))
      throw new RentalValidationError("Rental agreement end date is invalid.");
    if (property.paymentDay !== undefined && (!Number.isInteger(property.paymentDay) || property.paymentDay < 1 || property.paymentDay > 31))
      throw new RentalValidationError("Payment day is invalid.");
    if (property.administrationUrl && !isValidHttpsUrl(property.administrationUrl))
      throw new RentalValidationError("Administrator portal must use a valid HTTPS URL.");
    if (property.electricityUrl && !isValidHttpsUrl(property.electricityUrl)) throw new RentalValidationError("Electricity provider URL must use a valid HTTPS URL.");
    const rentRateMonths = new Set<string>();
    for (const rate of property.rentSchedule ?? []) {
      if (!isRentalMonth(rate.effectiveFrom) || !isNonnegativeMoney(rate.amount) || rentRateMonths.has(rate.effectiveFrom)) throw new RentalValidationError("Rent schedule is invalid.");
      if (rate.mediaAmount !== undefined && !isNonnegativeMoney(rate.mediaAmount)) throw new RentalValidationError("Rent schedule is invalid.");
      if (rate.mediaPaidByTenant !== undefined && typeof rate.mediaPaidByTenant !== "boolean") throw new RentalValidationError("Rent schedule is invalid.");
      if (rate.taxableTreatment !== undefined && !["OWNER_RENT", "RENT_AND_CHARGES"].includes(rate.taxableTreatment)) throw new RentalValidationError("Rent schedule is invalid.");
      if (rate.paymentDay !== undefined && (!Number.isInteger(rate.paymentDay) || rate.paymentDay < 1 || rate.paymentDay > 31)) throw new RentalValidationError("Rent schedule is invalid.");
      rentRateMonths.add(rate.effectiveFrom);
    }
    const lifecycleMonths = new Set<string>();
    for (const rate of property.lifecycleSchedule ?? []) {
      if (!isRentalMonth(rate.effectiveFrom) || !["ACTIVE", "PAUSED", "ARCHIVED"].includes(rate.lifecycle) || lifecycleMonths.has(rate.effectiveFrom)) throw new RentalValidationError("Apartment lifecycle schedule is invalid.");
      lifecycleMonths.add(rate.effectiveFrom);
    }
    const archivedAt = property.lifecycleSchedule?.find((rate) => rate.lifecycle === "ARCHIVED")?.effectiveFrom;
    if (archivedAt && property.lifecycleSchedule?.some((rate) => rate.effectiveFrom > archivedAt)) throw new RentalValidationError("Archived apartments cannot have later lifecycle changes.");
  }
  const administrationNames = new Set<string>();
  for (const administration of document.administrationSuggestions) {
    const normalized = administration.name.trim().toLocaleLowerCase("pl-PL");
    if (!normalized || administrationNames.has(normalized) || (administration.url && !isValidHttpsUrl(administration.url))) throw new RentalValidationError("Administration suggestions are invalid.");
    administrationNames.add(normalized);
  }
  const incomeIds = new Set<string>();
  for (const entry of document.incomeEntries) {
    if (incomeIds.has(entry.id))
      throw new RentalValidationError("Income entry IDs must be unique.");
    incomeIds.add(entry.id);
    if (entry.source !== undefined && entry.source !== "MANUAL" && entry.source !== "INITIAL_IMPORT") throw new RentalValidationError("Income source is invalid.");
    validateIncomeValues(entry, document.properties);
    if (entry.rentalMonth && !isRentalMonth(entry.rentalMonth))
      throw new RentalValidationError("Rental month is invalid.");
  }
  const taxIds = new Set<string>();
  for (const payment of document.taxPayments) {
    if (taxIds.has(payment.id))
      throw new RentalValidationError("Tax payment IDs must be unique.");
    taxIds.add(payment.id);
    if (
      !isSettlementPeriod(payment.period) ||
      !isValidCalendarDate(payment.paidAt) ||
      !isPositiveMoney(payment.amount) ||
      (payment.source !== undefined && payment.source !== "MANUAL" && payment.source !== "INITIAL_IMPORT")
    ) {
      throw new RentalValidationError("Tax payment is invalid.");
    }
  }
  const billIds = new Set<string>();
  for (const bill of document.recurringBills) {
    if (billIds.has(bill.id)) throw new RentalValidationError("Bill IDs must be unique.");
    billIds.add(bill.id);
    if (!document.properties.some((property) => property.id === bill.propertyId) || !bill.name.trim())
      throw new RentalValidationError("Recurring bill is invalid.");
    if (bill.reminderEnabled && bill.dueDay === undefined)
      throw new RentalValidationError("Enabled bill reminders require a due day.");
    if (bill.expectedAmount && !isPositiveMoney(bill.expectedAmount))
      throw new RentalValidationError("Bill amount is invalid.");
    if (bill.dueDay !== undefined && (!Number.isInteger(bill.dueDay) || bill.dueDay < 1 || bill.dueDay > 31))
      throw new RentalValidationError("Bill due day is invalid.");
    if (bill.bankAccount && !isValidPolishBankAccount(bill.bankAccount))
      throw new RentalValidationError("Bill bank account is invalid.");
  }
  const billPaymentIds = new Set<string>();
  for (const payment of document.billPayments) {
    if (billPaymentIds.has(payment.id)) throw new RentalValidationError("Bill payment IDs must be unique.");
    billPaymentIds.add(payment.id);
    if (!billIds.has(payment.billId) || !isRentalMonth(payment.period) || !isValidCalendarDate(payment.paidAt) || !isPositiveMoney(payment.amount))
      throw new RentalValidationError("Bill payment is invalid.");
  }
  const customIds = new Set<string>();
  for (const reminder of document.customReminders) {
    if (customIds.has(reminder.id) || !reminder.title.trim() || !isValidCalendarDate(reminder.dueDate) || (reminder.propertyId && !propertyIds.has(reminder.propertyId)) || !["ONCE", "MONTHLY", "YEARLY"].includes(reminder.recurrence)) throw new RentalValidationError("Custom reminder is invalid.");
    customIds.add(reminder.id);
  }
  const stateIds = new Set<string>();
  const validTaskId = /^(TENANT_PAYMENT_CHECK|TAX_PAYMENT|RECURRING_BILL|RENTAL_AGREEMENT_END|CUSTOM_REMINDER):[a-z0-9][a-z0-9._:-]*$/i;
  for (const state of document.taskStates) {
    if (!validTaskId.test(state.taskId) || stateIds.has(state.taskId) || [state.snoozedUntil, state.dismissedAt, state.completedAt].some((value) => value !== undefined && (typeof value !== "string" || Number.isNaN(new Date(value).getTime()) || new Date(value).toISOString() !== value))) throw new RentalValidationError("Task state is invalid.");
    stateIds.add(state.taskId);
  }
  const apartmentPeriodIds = new Set<string>();
  for (const snapshot of document.apartmentPeriods ?? []) {
    const id = `${snapshot.propertyId}:${snapshot.month}`;
    if (!propertyIds.has(snapshot.propertyId) || !isRentalMonth(snapshot.month) || apartmentPeriodIds.has(id) || (snapshot.ownerRent !== undefined && !isNonnegativeMoney(snapshot.ownerRent)) || (snapshot.expectedAmount !== undefined && !isNonnegativeMoney(snapshot.expectedAmount)) || typeof snapshot.expectedKnown !== "boolean" || !isNonnegativeMoney(snapshot.confirmedAmount) || !isNonnegativeMoney(snapshot.taxableAmount) || !isValidCalendarDate(snapshot.closedAt.slice(0, 10)) || !snapshot.receiptIds.every((receiptId) => incomeIds.has(receiptId))) throw new RentalValidationError("Apartment period snapshot is invalid.");
    apartmentPeriodIds.add(id);
  }
  const taxSnapshotPeriods = new Set<string>();
  for (const snapshot of document.taxSettlementSnapshots ?? []) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.period) || taxSnapshotPeriods.has(snapshot.period) || ![snapshot.revenue, snapshot.taxableBase, snapshot.cumulativeRevenue, snapshot.cumulativeTax, snapshot.obligation, snapshot.paid, snapshot.allocatedPaid, snapshot.creditApplied, snapshot.outstanding, snapshot.overpaid].every(isNonnegativeMoney) || !isValidCalendarDate(snapshot.dueDate) || !Number.isInteger(snapshot.rulesYear) || !isValidCalendarDate(snapshot.savedAt.slice(0, 10)) || !snapshot.receiptIds.every((receiptId) => incomeIds.has(receiptId)) || !snapshot.taxPaymentIds.every((paymentId) => taxIds.has(paymentId))) throw new RentalValidationError("Tax settlement snapshot is invalid.");
    taxSnapshotPeriods.add(snapshot.period);
  }
  if (document.settings.taxMicroAccount && !isValidPolishBankAccount(document.settings.taxMicroAccount))
    throw new RentalValidationError("Tax micro-account is invalid.");
  return document;
}

function isSettlementPeriod(value: string): boolean {
  return isRentalMonth(value) || /^\d{4}-Q[1-4]$/.test(value);
}
