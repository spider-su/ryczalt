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
  rentalEndDate?: string;
  rentalEndReminderDays?: number[];
  expectedPaymentDay?: number;
  paymentReminderEnabled?: boolean;
  paymentReminderDelayDays?: number;
  administratorName?: string;
  administratorPortalUrl?: string;
  administratorPhone?: string;
  administratorEmail?: string;
  notes?: string;
};

export type RecurringBill = {
  id: string;
  propertyId: string;
  name: string;
  recipientName?: string;
  bankAccount?: string;
  paymentTitle?: string;
  expectedAmount?: string;
  dueDay?: number;
  reminderEnabled: boolean;
  variableAmount?: boolean;
};

export type BillPayment = {
  id: string;
  billId: string;
  period: string;
  paidAt: string;
  amount: string;
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
  schemaVersion: 2;
  properties: Property[];
  incomeEntries: IncomeEntry[];
  taxPayments: TaxPayment[];
  recurringBills: RecurringBill[];
  billPayments: BillPayment[];
  settings: {
    taxYear: number;
    settlementMode: "monthly" | "quarterly";
    jointSpouseThreshold: boolean;
    quarterlyEligible: boolean;
    reminderCategories: {
      rent: boolean;
      agreements: boolean;
      tax: boolean;
      bills: boolean;
    };
    taxRecipientName?: string;
    taxMicroAccount?: string;
  };
};
