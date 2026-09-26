import { isPositiveMoney, isValidPolishBankAccount } from "./rentalValidation";

export type PaymentDetails = {
  recipientName?: string;
  bankAccount?: string;
  amount?: string;
  title?: string;
  dueDate?: string;
  propertyName?: string;
};

export function missingPaymentDetails(details: PaymentDetails): string[] {
  const missing: string[] = [];
  if (!details.recipientName?.trim()) missing.push("nazwa odbiorcy");
  if (!details.bankAccount || !isValidPolishBankAccount(details.bankAccount)) missing.push("prawidłowy polski numer rachunku");
  if (!details.amount || !isPositiveMoney(details.amount)) missing.push("kwota większa od zera");
  if (!details.title?.trim()) missing.push("tytuł płatności");
  return missing;
}
