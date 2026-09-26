import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IncomeEntry, Property, RentalDocument, TaxPayment } from '../model/rental';

export const RENTAL_DOCUMENT_SCHEMA_VERSION = 1;
export const RENTAL_DOCUMENT_STORAGE_KEY = 'pl.ryczalt.rental.localDocument.v1';

type RentalStoreErrorCode = 'CORRUPTED_DATA' | 'UNSUPPORTED_VERSION';

export class RentalStoreError extends Error {
  constructor(
    public readonly code: RentalStoreErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RentalStoreError';
  }
}

export const emptyDocument = (taxYear = new Date().getFullYear()): RentalDocument => ({
  schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
  properties: [],
  incomeEntries: [],
  taxPayments: [],
  settings: { taxYear }
});

export async function loadRentalDocument(): Promise<RentalDocument> {
  const raw = await AsyncStorage.getItem(RENTAL_DOCUMENT_STORAGE_KEY);
  if (!raw) return emptyDocument();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (_error) {
    throw new RentalStoreError('CORRUPTED_DATA', 'Local rental document is not valid JSON.');
  }
  return validateRentalDocument(data);
}

export async function saveRentalDocument(document: RentalDocument): Promise<void> {
  await AsyncStorage.setItem(RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(validateRentalDocument(document)));
}

function validateRentalDocument(data: unknown): RentalDocument {
  if (!isRecord(data)) throw corrupted('Local rental document must be a JSON object.');
  if (data.schemaVersion !== RENTAL_DOCUMENT_SCHEMA_VERSION) {
    throw new RentalStoreError('UNSUPPORTED_VERSION', 'Local rental document schema version is not supported.');
  }

  const settings = data.settings;
  if (!isRecord(settings) || typeof settings.taxYear !== 'number' || !Number.isInteger(settings.taxYear)) {
    throw corrupted('Local rental settings are invalid.');
  }
  const taxYear = settings.taxYear;

  const properties = validateArray(data.properties, validateProperty, 'properties');
  const incomeEntries = validateArray(data.incomeEntries, validateIncomeEntry, 'incomeEntries');
  const taxPayments = validateArray(data.taxPayments, validateTaxPayment, 'taxPayments');

  return {
    schemaVersion: RENTAL_DOCUMENT_SCHEMA_VERSION,
    properties,
    incomeEntries,
    taxPayments,
    settings: { taxYear }
  };
}

function validateProperty(value: unknown): Property {
  if (!isRecord(value) || !isStableId(value.id) || !isNonEmptyString(value.name)) throw corrupted('Property entry is invalid.');
  return {
    id: value.id,
    name: value.name,
    ...(optionalString(value.address) ? { address: value.address } : {}),
    ...(optionalDecimal(value.defaultMonthlyRent, 'defaultMonthlyRent') ? { defaultMonthlyRent: value.defaultMonthlyRent } : {}),
    ...(optionalString(value.tenantName) ? { tenantName: value.tenantName } : {}),
    ...(optionalString(value.tenantPhone) ? { tenantPhone: value.tenantPhone } : {}),
    ...(optionalString(value.tenantEmail) ? { tenantEmail: value.tenantEmail } : {}),
    ...(optionalString(value.tenantSince) ? { tenantSince: value.tenantSince } : {}),
    ...(optionalString(value.notes) ? { notes: value.notes } : {})
  };
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
    throw corrupted('Income entry is invalid.');
  }
  return {
    id: value.id,
    propertyId: value.propertyId,
    receivedAt: value.receivedAt,
    amount: value.amount,
    taxableAmount: value.taxableAmount,
    ...(optionalString(value.rentalMonth) ? { rentalMonth: value.rentalMonth } : {}),
    ...(optionalString(value.tenantNameSnapshot) ? { tenantNameSnapshot: value.tenantNameSnapshot } : {}),
    ...(optionalString(value.description) ? { description: value.description } : {})
  };
}

function validateTaxPayment(value: unknown): TaxPayment {
  if (!isRecord(value) || !isStableId(value.id) || !isNonEmptyString(value.period) || !isNonEmptyString(value.paidAt) || !isDecimalString(value.amount)) {
    throw corrupted('Tax payment entry is invalid.');
  }
  return { id: value.id, period: value.period, paidAt: value.paidAt, amount: value.amount };
}

function validateArray<T>(value: unknown, validate: (item: unknown) => T, name: string): T[] {
  if (!Array.isArray(value)) throw corrupted(`Local rental document ${name} must be an array.`);
  return value.map(validate);
}

function optionalDecimal(value: unknown, field: string): value is string {
  if (value === undefined) return false;
  if (isDecimalString(value)) return true;
  throw corrupted(`Money field ${field} must be a decimal string.`);
}

function optionalString(value: unknown): value is string {
  if (value === undefined) return false;
  if (typeof value === 'string') return true;
  throw corrupted('Optional text field must be a string.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStableId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

function corrupted(message: string): RentalStoreError {
  return new RentalStoreError('CORRUPTED_DATA', message);
}
