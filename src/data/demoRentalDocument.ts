import type { RentalDocument, IncomeEntry, Property, TaxPayment } from "../model/rental";
import { calculateSettlements, settlementPeriodForMonth, SUPPORTED_TAX_YEARS } from "../domain/ryczaltTax";

function monthShift(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year!, number! - 1 + offset, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDay(month: string, day: number) {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(year!, number!, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function createDemoRentalDocument(now = new Date()): RentalDocument {
  const supportedYear = SUPPORTED_TAX_YEARS.includes(now.getFullYear() as (typeof SUPPORTED_TAX_YEARS)[number])
    ? now.getFullYear()
    : Math.max(...SUPPORTED_TAX_YEARS);
  const currentMonth = `${supportedYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previousMonth = monthShift(currentMonth, -1);
  const leaseEnd = new Date(now.getFullYear(), now.getMonth() + 10, 1, 12);
  const leaseEndDate = `${leaseEnd.getFullYear()}-${String(leaseEnd.getMonth() + 1).padStart(2, "0")}-01`;
  const properties: Property[] = [
    {
      id: "demo-reduta", address: "Reduta 26B / 44", lifecycle: "ACTIVE", rentalStartDate: `${supportedYear}-01-01`,
      ownerRent: "2700", rentSchedule: [{ effectiveFrom: `${supportedYear}-01`, amount: "2700" }],
      mediaAmount: "910", mediaPaidByTenant: true, tenantName: "Anna Kipricz", tenantPhone: "+48 600 123 456",
      tenantEmail: "anna@example.com", tenantSince: `${supportedYear}-01-01`, leaseEndDate,
      paymentDay: 5, administrationName: "Administracja Reduta", administrationUrl: "https://example.com/reduta",
      electricityProvider: "TAURON",
    },
    {
      id: "demo-mogilska", address: "Mogilska 12 / 8", lifecycle: "ACTIVE", rentalStartDate: `${supportedYear}-02-01`,
      ownerRent: "3200", rentSchedule: [{ effectiveFrom: `${supportedYear}-02`, amount: "3200" }],
      mediaAmount: "650", mediaPaidByTenant: true, tenantName: "Marek Wiśniewski", tenantPhone: "+48 600 987 654",
      tenantEmail: "marek@example.com", tenantSince: `${supportedYear}-02-01`, leaseEndDate,
      paymentDay: 5, administrationName: "Administracja Mogilska", electricityProvider: "PGE",
    },
  ];
  const incomeEntries: IncomeEntry[] = [
    { id: "demo-income-reduta-prior", propertyId: "demo-reduta", receivedAt: monthDay(previousMonth, 5), rentalMonth: previousMonth, amount: "3610", taxableAmount: "2700", tenantNameSnapshot: "Anna Kipricz", source: "MANUAL" },
    { id: "demo-income-reduta-current", propertyId: "demo-reduta", receivedAt: monthDay(currentMonth, now.getDate()), rentalMonth: currentMonth, amount: "3610", taxableAmount: "2700", tenantNameSnapshot: "Anna Kipricz", source: "MANUAL" },
    { id: "demo-income-mogilska-current", propertyId: "demo-mogilska", receivedAt: monthDay(currentMonth, now.getDate()), rentalMonth: currentMonth, amount: "1900", taxableAmount: "1900", tenantNameSnapshot: "Marek Wiśniewski", description: "Częściowa wpłata za czynsz", source: "MANUAL" },
  ];
  const priorPeriod = settlementPeriodForMonth(previousMonth, "monthly")!;
  const priorSettlement = calculateSettlements({ entries: incomeEntries, payments: [], taxYear: supportedYear, mode: "monthly", today: now.toISOString().slice(0, 10) })
    .find((item) => item.period === priorPeriod);
  const taxPayments: TaxPayment[] = priorSettlement && priorSettlement.obligationGrosz > 0
    ? [{ id: "demo-tax-prior", period: priorPeriod, paidAt: monthDay(currentMonth, Math.min(now.getDate(), 20)), amount: (priorSettlement.obligationGrosz / 100).toFixed(2) }]
    : [];
  return {
    schemaVersion: 6, properties, incomeEntries, taxPayments, recurringBills: [], billPayments: [], propertyLinks: [],
    administrationSuggestions: [],
    customReminders: [{ id: "demo-reminder-inspection", title: "Przegląd mieszkania", propertyId: "demo-reduta", dueDate: monthDay(monthShift(currentMonth, 1), 12), note: "Umów dogodny termin", recurrence: "ONCE" }],
    taskStates: [],
    settings: {
      taxYear: supportedYear, settlementMode: "monthly", jointSpouseThreshold: false, quarterlyEligible: false,
      reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1,
      taxRecipientName: "Urząd Skarbowy Kraków", taxMicroAccount: "12 1010 1270 0000 0000 0000 0000",
    },
  };
}

export async function applyRentalDocumentChange(
  current: RentalDocument,
  change: (document: RentalDocument) => RentalDocument,
  isDemoMode: boolean,
  persist: (document: RentalDocument) => Promise<void>,
) {
  const next = change(current);
  if (!isDemoMode) await persist(next);
  return next;
}

export function shouldReconcileNotifications(isDemoMode: boolean, hasDocument: boolean, permissionGranted: boolean) {
  return !isDemoMode && hasDocument && permissionGranted;
}
