/** Versioned local document; monetary amounts are decimal strings in PLN. */
export type Property = {
  id: string;
  address: string;
  lifecycle?: "ACTIVE" | "PAUSED" | "ARCHIVED";
  /** Effective-month lifecycle history; ARCHIVED is terminal. */
  lifecycleSchedule?: ApartmentLifecycleRate[];
  rentalStartDate?: string;
  ownerRent?: string;
  rentSchedule?: RentRate[];
  mediaAmount?: string;
  mediaPaidByTenant?: boolean;
  /** Explicit contract-dependent tax base; absent until the landlord confirms it. */
  taxableTreatment?: "OWNER_RENT" | "RENT_AND_CHARGES";
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  leaseEndDate?: string;
  paymentDay?: number;
  administrationName?: string;
  administrationUrl?: string;
  electricityProvider?: string;
  electricityUrl?: string;
  notes?: string;
};

export type AdministrationSuggestion = { name: string; url?: string };

/** Complete rent terms effective from the given calendar month. */
export type RentRate = {
  effectiveFrom: string;
  amount: string;
  mediaAmount?: string;
  mediaPaidByTenant?: boolean;
  taxableTreatment?: "OWNER_RENT" | "RENT_AND_CHARGES";
  paymentDay?: number;
};

export type ApartmentPeriodSnapshot = {
  propertyId: string;
  month: string;
  ownerRent?: string;
  expectedAmount?: string;
  expectedKnown: boolean;
  confirmedAmount: string;
  taxableAmount: string;
  receiptIds: string[];
  closedAt: string;
};

export type TaxSettlementSnapshot = {
  period: string;
  revenue: string;
  taxableBase: string;
  cumulativeRevenue: string;
  cumulativeTax: string;
  obligation: string;
  paid: string;
  allocatedPaid: string;
  creditApplied: string;
  outstanding: string;
  overpaid: string;
  dueDate: string;
  rulesYear: number;
  receiptIds: string[];
  taxPaymentIds: string[];
  savedAt: string;
};

export type ApartmentLifecycleRate = { effectiveFrom: string; lifecycle: "ACTIVE" | "PAUSED" | "ARCHIVED" };

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
  source?: "MANUAL" | "INITIAL_IMPORT";
};

export type TaxPayment = {
  id: string;
  period: string;
  paidAt: string;
  amount: string;
  source?: "MANUAL" | "INITIAL_IMPORT";
};

export type RentalDocument = {
  schemaVersion: 1;
  properties: Property[];
  incomeEntries: IncomeEntry[];
  taxPayments: TaxPayment[];
  recurringBills: RecurringBill[];
  billPayments: BillPayment[];
  administrationSuggestions: AdministrationSuggestion[];
  customReminders: CustomReminder[];
  taskStates: TaskState[];
  apartmentPeriods: ApartmentPeriodSnapshot[];
  taxSettlementSnapshots: TaxSettlementSnapshot[];
  settings: {
    taxYear: number;
    settlementMode: "monthly";
    jointSpouseThreshold: boolean;
    reminderCategories: {
      rent: boolean;
      agreements: boolean;
      tax: boolean;
      bills: boolean;
      custom: boolean;
    };
    rentReminderDelayDays: number;
    taxRecipientName?: string;
    taxMicroAccount?: string;
    openingTaxableRevenue?: string;
    openingTaxPaid?: string;
  };
};
