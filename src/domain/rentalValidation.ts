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
  return DECIMAL_PATTERN.test(value);
}

export function isPositiveMoney(value: string): boolean {
  return isDecimalString(value) && compareDecimalStrings(value, "0") > 0;
}

export function isNonnegativeMoney(value: string): boolean {
  return isDecimalString(value) && compareDecimalStrings(value, "0") >= 0;
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
      !isRentalMonth(payment.period) ||
      !isValidCalendarDate(payment.paidAt) ||
      !isPositiveMoney(payment.amount)
    ) {
      throw new RentalValidationError("Tax payment is invalid.");
    }
  }
  return document;
}
