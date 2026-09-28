/** Versioned local document; monetary amounts are decimal strings in PLN. */
export type Property = {
  id: string;
  name: string;
  defaultMonthlyRent?: string;
  rentSchedule?: RentRate[];
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantSince?: string;
  rentalEndDate?: string;
  rentalEndReminderDays?: number[];
  expectedPaymentDay?: number;
  paymentReminderEnabled?: boolean;
  paymentReminderDelayDays?: number;
  administratorPortalUrl?: string;
  notes?: string;
};

export type RentRate = { effectiveFrom: string; amount: string };

export type PropertyLink = {
  id: string;
  propertyId: string;
  label: string;
  url: string;
  category?: "ADMINISTRATION" | "UTILITY" | "TAX" | "OTHER";
};

export type ReminderRecurrence = "ONCE" | "MONTHLY" | "YEARLY";

export type CustomReminder = {
  id: string;
  title: string;
  propertyId?: string;
  dueDate: string;
  note?: string;
  recurrence: ReminderRecurrence;
};

export type TaskState = {
  taskId: string;
  snoozedUntil?: string;
  dismissedAt?: string;
  completedAt?: string;
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
  schemaVersion: 4;
  properties: Property[];
  incomeEntries: IncomeEntry[];
  taxPayments: TaxPayment[];
  recurringBills: RecurringBill[];
  billPayments: BillPayment[];
  propertyLinks: PropertyLink[];
  customReminders: CustomReminder[];
  taskStates: TaskState[];
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
      custom: boolean;
    };
    taxRecipientName?: string;
    taxMicroAccount?: string;
  };
};
