import type { IncomeEntry, Property, RentalDocument } from "../model/rental";
import {
  isRentalMonth,
  RentalValidationError,
  validateIncomeValues,
} from "./rentalValidation";

export type IncomeInput = Pick<
  IncomeEntry,
  "propertyId" | "receivedAt" | "amount" | "taxableAmount"
> &
  Partial<Pick<IncomeEntry, "rentalMonth" | "description">>;

export function createIncomeEntry(
  input: IncomeInput,
  property: Property,
  id: string,
): IncomeEntry {
  validateRentalMonth(input.rentalMonth);
  validateIncomeValues(input, [property]);
  return {
    id,
    propertyId: input.propertyId,
    receivedAt: input.receivedAt,
    amount: input.amount,
    taxableAmount: input.taxableAmount,
    ...(input.rentalMonth ? { rentalMonth: input.rentalMonth } : {}),
    ...(property.tenantName ? { tenantNameSnapshot: property.tenantName } : {}),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
  };
}

export function editIncomeEntry(
  existing: IncomeEntry,
  input: IncomeInput,
): IncomeEntry {
  validateRentalMonth(input.rentalMonth);
  validateIncomeValues(input, [
    { id: input.propertyId, name: "historical reference" },
  ]);
  return {
    ...existing,
    propertyId: input.propertyId,
    receivedAt: input.receivedAt,
    amount: input.amount,
    taxableAmount: input.taxableAmount,
    ...(input.rentalMonth
      ? { rentalMonth: input.rentalMonth }
      : { rentalMonth: undefined }),
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : { description: undefined }),
  };
}

export function removePropertyData(document: RentalDocument, propertyId: string): RentalDocument {
  if (document.incomeEntries.some((entry) => entry.propertyId === propertyId))
    throw new RentalValidationError("Properties with confirmed income history cannot be deleted.");
  const billIds = new Set(document.recurringBills.filter((bill) => bill.propertyId === propertyId).map((bill) => bill.id));
  return {
    ...document,
    properties: document.properties.filter((property) => property.id !== propertyId),
    recurringBills: document.recurringBills.filter((bill) => bill.propertyId !== propertyId),
    billPayments: document.billPayments.filter((payment) => !billIds.has(payment.billId)),
    propertyLinks: document.propertyLinks.filter((link) => link.propertyId !== propertyId),
    customReminders: document.customReminders.map((reminder) => reminder.propertyId === propertyId
      ? { ...reminder, propertyId: undefined }
      : reminder),
    taskStates: document.taskStates.filter((state) =>
      !state.taskId.startsWith(`TENANT_PAYMENT_CHECK:${propertyId}:`) &&
      !state.taskId.startsWith(`RENTAL_AGREEMENT_END:${propertyId}:`) &&
      ![...billIds].some((billId) => state.taskId.startsWith(`RECURRING_BILL:${billId}:`))),
  };
}

function validateRentalMonth(value: string | undefined): void {
  if (value && !isRentalMonth(value))
    throw new RentalValidationError("Rental month is invalid.");
}
