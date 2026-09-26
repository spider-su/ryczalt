import type { IncomeEntry, Property } from "../model/rental";
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

function validateRentalMonth(value: string | undefined): void {
  if (value && !isRentalMonth(value))
    throw new RentalValidationError("Rental month is invalid.");
}
