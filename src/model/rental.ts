/** Versioned local document; monetary amounts are decimal strings in PLN. */
export type Property = {
  id: string;
  name: string;
  address?: string;
  defaultMonthlyRent?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantSince?: string;
  notes?: string;
};

export type IncomeEntry = {
  id: string;
  propertyId: string;
  receivedAt: string;
  amount: string;
  taxableAmount: string;
  rentalMonth?: string;
  tenantNameSnapshot?: string;
  description?: string;
};

export type TaxPayment = {
  id: string;
  period: string;
  paidAt: string;
  amount: string;
};

export type RentalDocument = {
  schemaVersion: 1;
  properties: Property[];
  incomeEntries: IncomeEntry[];
  taxPayments: TaxPayment[];
  settings: { taxYear: number };
};
