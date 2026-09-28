import type { RentalDocument, IncomeEntry, Property, TaxPayment } from "../model/rental";
import { calculateSettlements, settlementPeriodForMonth, SUPPORTED_TAX_YEARS, todayInPoland } from "../domain/ryczaltTax";

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
  const today = todayInPoland(now);
  const leaseEnd = new Date(now.getFullYear(), now.getMonth() + 10, 1, 12);
  const leaseEndDate = `${leaseEnd.getFullYear()}-${String(leaseEnd.getMonth() + 1).padStart(2, "0")}-01`;
  const properties: Property[] = [
    {
      id: "demo-piotrkowska", address: "ul. Piotrkowska 18 / 7, Łódź", lifecycle: "ACTIVE", rentalStartDate: `${supportedYear}-01-01`,
      ownerRent: "2700", rentSchedule: [{ effectiveFrom: `${supportedYear}-01`, amount: "2700", mediaAmount: "910", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT", paymentDay: 5 }],
      mediaAmount: "910", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT", tenantName: "Zofia Kowalska", tenantPhone: "+48 600 123 456",
      tenantEmail: "zofia@example.com", leaseEndDate,
      paymentDay: 5, administrationName: "Administracja Piotrkowska", administrationUrl: "https://example.com/piotrkowska",
      electricityProvider: "TAURON",
    },
    {
      id: "demo-mogilska", address: "Mogilska 12 / 8", lifecycle: "ACTIVE", rentalStartDate: `${supportedYear}-02-01`,
      ownerRent: "3200", rentSchedule: [{ effectiveFrom: `${supportedYear}-02`, amount: "3200", mediaAmount: "650", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT", paymentDay: 5 }],
      mediaAmount: "650", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT", tenantName: "Marek Wiśniewski", tenantPhone: "+48 600 987 654",
      tenantEmail: "marek@example.com", leaseEndDate,
      paymentDay: 5, administrationName: "Administracja Mogilska", electricityProvider: "PGE",
    },
  ];
  const months = Array.from({ length: now.getMonth() + 1 }, (_, index) => `${supportedYear}-${String(index + 1).padStart(2, "0")}`);
  const incomeEntries: IncomeEntry[] = properties.flatMap((property) => {
    const startMonth = property.rentalStartDate!.slice(0, 7);
    return months.filter((month) => month >= startMonth).map((month) => {
      const partialCurrentRent = property.id === "demo-mogilska" && month === currentMonth;
      const amount = partialCurrentRent ? "1900" : property.id === "demo-piotrkowska" ? "3610" : "3850";
      const taxableAmount = partialCurrentRent ? "1900" : property.ownerRent!;
      return {
        id: `demo-income-${property.id.replace("demo-", "")}-${month}`,
        propertyId: property.id,
        receivedAt: monthDay(month, month === currentMonth ? now.getDate() : 5),
        rentalMonth: month,
        amount,
        taxableAmount,
        tenantNameSnapshot: property.tenantName,
        ...(partialCurrentRent ? { description: "Częściowa wpłata za czynsz" } : {}),
        source: "MANUAL" as const,
      };
    });
  });
  const settlements = calculateSettlements({ entries: incomeEntries, payments: [], taxYear: supportedYear, mode: "monthly", today });
  const taxPayments: TaxPayment[] = settlements
    .filter((settlement) => settlement.obligationGrosz > 0 && settlement.dueDate <= today)
    .map((settlement) => ({
      id: `demo-tax-${settlement.period}`,
      period: settlementPeriodForMonth(settlement.period, "monthly")!,
      paidAt: settlement.dueDate,
      amount: (settlement.obligationGrosz / 100).toFixed(2),
    }));
  return {
    schemaVersion: 1, properties, incomeEntries, taxPayments, recurringBills: [], billPayments: [], apartmentPeriods: [], taxSettlementSnapshots: [],
    administrationSuggestions: [],
    customReminders: [{ id: "demo-reminder-inspection", title: "Przegląd mieszkania", propertyId: "demo-piotrkowska", dueDate: monthDay(monthShift(currentMonth, 1), 12), note: "Umów dogodny termin", recurrence: "ONCE" }],
    taskStates: [],
    settings: {
      taxYear: supportedYear, settlementMode: "monthly", jointSpouseThreshold: false,
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
