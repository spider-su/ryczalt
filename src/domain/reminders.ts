import { calculateSettlements, formatPln, moneyToGrosz } from "./ryczaltTax";
import type { IncomeEntry, Property, RentalDocument } from "../model/rental";

export type LocalReminder = {
  key: string;
  signature: string;
  title: string;
  body: string;
  fireAt: Date;
  data: { category: "rent" | "agreement" | "tax" | "bill"; propertyId?: string; period?: string; billId?: string };
};

export type RentMonthSummary = {
  expectedGrosz: number;
  confirmedGrosz: number;
  remainingGrosz: number;
  status: "complete" | "check" | "unknown";
};

export function summarizeRentMonth(
  property: Property,
  entries: IncomeEntry[],
  rentalMonth: string,
): RentMonthSummary {
  const expectedGrosz = property.defaultMonthlyRent ? moneyToGrosz(property.defaultMonthlyRent) : 0;
  const confirmedGrosz = entries
    .filter((entry) => entry.propertyId === property.id && entry.rentalMonth === rentalMonth)
    .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
  const remainingGrosz = Math.max(0, expectedGrosz - confirmedGrosz);
  return {
    expectedGrosz,
    confirmedGrosz,
    remainingGrosz,
    status: !expectedGrosz ? "unknown" : remainingGrosz === 0 ? "complete" : "check",
  };
}

export function buildReminderPlan(document: RentalDocument, now = new Date()): LocalReminder[] {
  const reminders: LocalReminder[] = [];
  const today = localDay(now);
  for (const property of document.properties) {
    if (property.rentalEndDate && property.rentalEndReminderDays?.length && document.settings.reminderCategories.agreements) {
      for (const daysBefore of property.rentalEndReminderDays) {
        const endDate = parseLocalDate(property.rentalEndDate);
        const fireAt = atNine(endDate);
        fireAt.setDate(fireAt.getDate() - daysBefore);
        if (fireAt <= now) continue;
        const dateLabel = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${endDate.getFullYear()}`;
        reminders.push(makeReminder({
          key: `agreement:${property.id}:${daysBefore}:${property.rentalEndDate}`,
          title: daysBefore ? `Umowa najmu kończy się za ${daysBefore} dni` : "Umowa najmu kończy się dzisiaj",
          body: `${property.name} — umowa najmu kończy się ${dateLabel}.`, fireAt,
          data: { category: "agreement", propertyId: property.id },
        }));
      }
    }
    if (property.paymentReminderEnabled && property.expectedPaymentDay && document.settings.reminderCategories.rent) {
      for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
        const expectedDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 9);
        const daysInMonth = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
        expectedDate.setDate(Math.min(property.expectedPaymentDay, daysInMonth));
        const rentalMonth = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, "0")}`;
        const due = new Date(expectedDate);
        due.setDate(due.getDate() + (property.paymentReminderDelayDays ?? 1));
        due.setHours(9, 0, 0, 0);
        if (due <= now || summarizeRentMonth(property, document.incomeEntries, rentalMonth).remainingGrosz === 0) continue;
        const periodName = new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(expectedDate);
        reminders.push(makeReminder({
          key: `rent:${property.id}:${rentalMonth}`,
          title: "Sprawdź wpłatę czynszu",
          body: `Mieszkanie ${property.name} — sprawdź, czy otrzymano czynsz za ${periodName}.`,
          fireAt: due, data: { category: "rent", propertyId: property.id, period: rentalMonth },
        }));
      }
    }
  }

  if (document.settings.reminderCategories.tax && (document.settings.taxYear === 2025 || document.settings.taxYear === 2026)) {
    const settlements = calculateSettlements({
      entries: document.incomeEntries, payments: document.taxPayments,
      taxYear: document.settings.taxYear, mode: document.settings.settlementMode,
      jointSpouseThreshold: document.settings.jointSpouseThreshold, today: dateString(today),
    });
    for (const settlement of settlements) {
      if (settlement.outstandingGrosz <= 0) continue;
      const dueDate = parseLocalDate(settlement.dueDate);
      if (localDay(dueDate) <= today) continue;
      const fireAt = atNine(dueDate);
      fireAt.setDate(fireAt.getDate() - 3);
      if (fireAt <= now) {
        fireAt.setTime(now.getTime());
        fireAt.setDate(fireAt.getDate() + 1);
        fireAt.setHours(9, 0, 0, 0);
      }
      if (fireAt >= dueDate) continue;
      reminders.push(makeReminder({
        key: `tax:${settlement.period}`,
        title: "Podatek do zapłaty",
        body: `Ryczałt za ${describePeriod(settlement.period)} — pozostało ${formatPln(settlement.outstandingGrosz)}. Termin: ${settlement.dueDate}.`,
        fireAt, data: { category: "tax", period: settlement.period },
      }));
    }
  }

  if (document.settings.reminderCategories.bills) {
    for (const bill of document.recurringBills) {
      if (!bill.reminderEnabled || !bill.dueDay) continue;
      for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
        const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 9);
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(bill.dueDay, daysInMonth));
        date.setHours(9, 0, 0, 0);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (date <= now || document.billPayments.some((payment) => payment.billId === bill.id && payment.period === period)) continue;
        const property = document.properties.find((item) => item.id === bill.propertyId);
        const body = bill.variableAmount || !bill.expectedAmount
          ? `${bill.name} — sprawdź bieżącą kwotę${property ? ` dla mieszkania ${property.name}` : ""}.`
          : `${bill.name} — przypomnienie o płatności ${bill.expectedAmount} zł${property ? `, ${property.name}` : ""}.`;
        reminders.push(makeReminder({
          key: `bill:${bill.id}:${period}`, title: `Sprawdź płatność: ${bill.name}`,
          body, fireAt: date, data: { category: "bill", propertyId: bill.propertyId, billId: bill.id, period },
        }));
      }
    }
  }
  return reminders.sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime());
}

function makeReminder(input: Omit<LocalReminder, "signature">): LocalReminder {
  return { ...input, signature: `${input.title}|${input.body}|${input.fireAt.getTime()}` };
}

function localDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function atNine(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 9, 0, 0, 0);
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 9, 0, 0, 0);
}

function dateString(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function describePeriod(period: string): string {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `${quarter[2]}. kwartał ${quarter[1]}`;
  const [year, month] = period.split("-");
  const monthName = new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(new Date(Number(year), Number(month) - 1, 1));
  return `${monthName} ${year}`;
}
