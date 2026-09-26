import type { IncomeEntry, Property, RentalDocument } from "../model/rental";

export const RENTAL_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const AGREEMENT_REMINDER_DAYS = [90, 60, 30, 14, 7, 0] as const;

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
  if (document.schemaVersion !== 2)
    throw new RentalValidationError(
      "Unsupported rental document schema version.",
    );
  const propertyIds = new Set<string>();
  for (const property of document.properties) {
    if (propertyIds.has(property.id))
      throw new RentalValidationError("Property IDs must be unique.");
    propertyIds.add(property.id);
    if (property.tenantSince && !isValidCalendarDate(property.tenantSince))
      throw new RentalValidationError("Tenant start date is invalid.");
    if (
      property.defaultMonthlyRent &&
      !isNonnegativeMoney(property.defaultMonthlyRent)
    )
      throw new RentalValidationError("Default rent is invalid.");
    if (property.rentalEndDate && !isValidCalendarDate(property.rentalEndDate))
      throw new RentalValidationError("Rental agreement end date is invalid.");
    if (property.expectedPaymentDay !== undefined && (!Number.isInteger(property.expectedPaymentDay) || property.expectedPaymentDay < 1 || property.expectedPaymentDay > 31))
      throw new RentalValidationError("Expected payment day is invalid.");
    if (property.paymentReminderDelayDays !== undefined && (!Number.isInteger(property.paymentReminderDelayDays) || property.paymentReminderDelayDays < 0 || property.paymentReminderDelayDays > 30))
      throw new RentalValidationError("Rent reminder delay is invalid.");
    if (property.rentalEndReminderDays?.some((days) => !AGREEMENT_REMINDER_DAYS.includes(days as typeof AGREEMENT_REMINDER_DAYS[number])) || new Set(property.rentalEndReminderDays ?? []).size !== (property.rentalEndReminderDays ?? []).length)
      throw new RentalValidationError("Agreement reminder preferences are invalid.");
    if (property.administratorPortalUrl && !isValidHttpsUrl(property.administratorPortalUrl))
      throw new RentalValidationError("Administrator portal must use a valid HTTPS URL.");
  }
  const incomeIds = new Set<string>();
  for (const entry of document.incomeEntries) {
    if (incomeIds.has(entry.id))
      throw new RentalValidationError("Income entry IDs must be unique.");
    incomeIds.add(entry.id);
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
      !isPositiveMoney(payment.amount)
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
  if (document.settings.taxMicroAccount && !isValidPolishBankAccount(document.settings.taxMicroAccount))
    throw new RentalValidationError("Tax micro-account is invalid.");
  return document;
}

function isSettlementPeriod(value: string): boolean {
  return isRentalMonth(value) || /^\d{4}-Q[1-4]$/.test(value);
}
