import type { RentalDocument, TaxPayment } from "../model/rental";

export function upsertTaxPayment(document: RentalDocument, payment: TaxPayment): RentalDocument {
  const exists = document.taxPayments.some((item) => item.id === payment.id);
  return {
    ...document,
    taxPayments: exists
      ? document.taxPayments.map((item) => item.id === payment.id ? payment : item)
      : [...document.taxPayments, payment],
  };
}

export function removeTaxPayment(document: RentalDocument, paymentId: string): RentalDocument {
  return { ...document, taxPayments: document.taxPayments.filter((item) => item.id !== paymentId) };
}
