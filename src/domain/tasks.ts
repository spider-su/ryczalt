import { calculateSettlements, formatPln, moneyToGrosz } from "./ryczaltTax";
import { customReminderTaskId, recurrenceLabel, reminderOccurrenceDates } from "./customReminders";
import { isRentalMonth } from "./rentalValidation";
import type { Property, RentalDocument, TaskState } from "../model/rental";

export type TaskType = "TENANT_PAYMENT_CHECK" | "TAX_PAYMENT" | "RECURRING_BILL" | "RENTAL_AGREEMENT_END" | "CUSTOM_REMINDER";
export type TaskStatus = "upcoming" | "needs-attention" | "snoozed" | "completed" | "dismissed";
export type AssistantTask = {
  id: string;
  type: TaskType;
  title: string;
  detail: string;
  propertyId?: string;
  period?: string;
  dueAt: Date;
  notificationAt: Date;
  status: TaskStatus;
  expectedGrosz?: number;
  confirmedGrosz?: number;
  remainingGrosz?: number;
  dismissible: boolean;
  manuallyCompletable: boolean;
};

export function expectedRentForMonth(property: Property, month: string, now = new Date()): number | null {
  if (!isRentalMonth(month)) return null;
  const rates = [...(property.rentSchedule ?? [])].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const applicable = rates.find((rate) => rate.effectiveFrom <= month);
  if (applicable) return moneyToGrosz(applicable.amount);
  const currentMonth = monthOf(now);
  if (!rates.length && month >= currentMonth && property.defaultMonthlyRent !== undefined) return moneyToGrosz(property.defaultMonthlyRent);
  return null;
}

export function rentMonthAmounts(document: RentalDocument, property: Property, month: string, now = new Date()) {
  const expectedGrosz = expectedRentForMonth(property, month, now);
  const confirmedGrosz = document.incomeEntries.filter((entry) => entry.propertyId === property.id && entry.rentalMonth === month)
    .reduce((total, entry) => total + moneyToGrosz(entry.amount), 0);
  return { expectedGrosz, confirmedGrosz, remainingGrosz: expectedGrosz === null ? null : Math.max(0, expectedGrosz - confirmedGrosz) };
}

export function deriveTasks(document: RentalDocument, now = new Date()): AssistantTask[] {
  const tasks: AssistantTask[] = [];
  const current = monthOf(now);
  for (const property of document.properties) {
    if (property.expectedPaymentDay) {
      for (let offset = -2; offset <= 6; offset++) {
        const period = shiftMonth(current, offset);
        const amounts = rentMonthAmounts(document, property, period, now);
        if (amounts.expectedGrosz === null || amounts.expectedGrosz === 0 || amounts.remainingGrosz === null) continue;
        const dueAt = paymentDay(period, property.expectedPaymentDay);
        const notificationAt = addDays(dueAt, property.paymentReminderDelayDays ?? 1);
        const remaining = amounts.remainingGrosz;
        const done = remaining === 0;
        const title = done ? `Czynsz potwierdzony — ${property.name}` : remaining < amounts.expectedGrosz
          ? `Sprawdź pozostałą wpłatę — ${formatPln(remaining)}`
          : `Sprawdź czynsz — ${property.name}`;
        const detail = `Za ${monthLabel(period)}: oczekiwano ${formatPln(amounts.expectedGrosz)}, potwierdzono ${formatPln(amounts.confirmedGrosz)}${remaining ? `, do potwierdzenia ${formatPln(remaining)}` : ""}.`;
        tasks.push(makeTask(document, now, {
          id: `TENANT_PAYMENT_CHECK:${property.id}:${period}`, type: "TENANT_PAYMENT_CHECK", title, detail,
          propertyId: property.id, period, dueAt, notificationAt, expectedGrosz: amounts.expectedGrosz,
          confirmedGrosz: amounts.confirmedGrosz, remainingGrosz: remaining, resolved: done,
        }));
      }
    }
    if (property.rentalEndDate) {
      const dueAt = localDate(property.rentalEndDate);
      const offsets = property.rentalEndReminderDays ?? [];
      const firstOffset = offsets.length ? Math.max(...offsets) : 30;
      const notificationAt = addDays(dueAt, -firstOffset);
      tasks.push(makeTask(document, now, {
        id: `RENTAL_AGREEMENT_END:${property.id}:${property.rentalEndDate}`, type: "RENTAL_AGREEMENT_END",
        title: `Umowa najmu — ${property.name}`, detail: `Umowa kończy się ${formatDate(property.rentalEndDate)}.`,
        propertyId: property.id, dueAt, notificationAt, resolved: false, manuallyCompletable: true,
      }));
    }
  }

  if ([2025, 2026].includes(document.settings.taxYear)) {
    const settlements = calculateSettlements({ entries: document.incomeEntries, payments: document.taxPayments,
      taxYear: document.settings.taxYear, mode: document.settings.settlementMode,
      jointSpouseThreshold: document.settings.jointSpouseThreshold, today: localIso(now) });
    for (const settlement of settlements) {
      if (settlement.obligationGrosz <= 0) continue;
      const dueAt = localDate(settlement.dueDate);
      const notificationAt = addDays(dueAt, -3);
      tasks.push(makeTask(document, now, {
        id: `TAX_PAYMENT:${settlement.period}`, type: "TAX_PAYMENT",
        title: settlement.outstandingGrosz ? `Podatek za ${periodLabel(settlement.period)}` : `Podatek opłacony — ${periodLabel(settlement.period)}`,
        detail: `Obowiązek ${formatPln(settlement.obligationGrosz)}, wpłacono ${formatPln(settlement.paidGrosz)}, pozostało ${formatPln(settlement.outstandingGrosz)}. Termin ${formatDate(settlement.dueDate)}.`,
        period: settlement.period, dueAt, notificationAt, expectedGrosz: settlement.obligationGrosz,
        confirmedGrosz: settlement.paidGrosz, remainingGrosz: settlement.outstandingGrosz,
        resolved: settlement.outstandingGrosz === 0,
      }));
    }
  }

  {
    for (const bill of document.recurringBills) {
      if (!bill.dueDay) continue;
      for (let offset = -1; offset <= 3; offset++) {
        const period = shiftMonth(current, offset);
        const dueAt = paymentDay(period, bill.dueDay);
        const variable = bill.variableAmount || !bill.expectedAmount;
        const payments = document.billPayments.filter((payment) => payment.billId === bill.id && payment.period === period);
        const confirmedGrosz = variable ? undefined : payments.reduce((sum, payment) => sum + moneyToGrosz(payment.amount), 0);
        const expectedGrosz = variable ? undefined : moneyToGrosz(bill.expectedAmount!);
        const remainingGrosz = expectedGrosz === undefined ? undefined : Math.max(0, expectedGrosz - confirmedGrosz!);
        const paid = variable ? payments.length > 0 : remainingGrosz === 0;
        const property = document.properties.find((item) => item.id === bill.propertyId);
        const amountDetail = variable
          ? "Sprawdź bieżącą kwotę."
          : remainingGrosz === 0
            ? `Oczekiwano ${formatPln(expectedGrosz!)}, potwierdzono ${formatPln(confirmedGrosz!)}.`
            : confirmedGrosz! > 0
              ? `Oczekiwano ${formatPln(expectedGrosz!)}, potwierdzono ${formatPln(confirmedGrosz!)}, pozostało ${formatPln(remainingGrosz!)}.`
              : `Oczekiwano ${formatPln(expectedGrosz!)}.`;
        tasks.push(makeTask(document, now, {
          id: `RECURRING_BILL:${bill.id}:${period}`, type: "RECURRING_BILL",
          title: paid ? `${bill.name} — opłacono` : `Płatność: ${bill.name}`,
          detail: `${property?.name ? `${property.name} · ` : ""}${amountDetail}`,
          propertyId: bill.propertyId, period, dueAt, notificationAt: dueAt,
          expectedGrosz, confirmedGrosz, remainingGrosz,
          resolved: paid,
        }));
      }
    }
  }

  {
    for (const reminder of document.customReminders) {
      for (const date of reminderOccurrenceDates(reminder, now)) {
        const dueAt = localDate(date);
        const propertyName = reminder.propertyId ? document.properties.find((p) => p.id === reminder.propertyId)?.name : undefined;
        const recurringContext = reminder.recurrence === "ONCE" ? undefined : recurrenceLabel(reminder.recurrence, reminder.dueDate);
        tasks.push(makeTask(document, now, {
          id: customReminderTaskId(reminder, date), type: "CUSTOM_REMINDER", title: reminder.title,
          detail: [recurringContext, reminder.note, propertyName].filter(Boolean).join(" · "),
          propertyId: reminder.propertyId, period: date, dueAt, notificationAt: dueAt, resolved: false, manuallyCompletable: true,
        }));
      }
    }
  }
  return tasks.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

function makeTask(document: RentalDocument, now: Date, input: Omit<AssistantTask, "status" | "dismissible" | "manuallyCompletable"> & { resolved: boolean; manuallyCompletable?: boolean }): AssistantTask {
  const state = document.taskStates.find((item) => item.taskId === input.id);
  const activeSnooze = state?.snoozedUntil ? new Date(state.snoozedUntil) : undefined;
  const snoozed = !input.resolved && activeSnooze !== undefined && activeSnooze > now;
  const manuallyCompleted = Boolean(state?.completedAt) && Boolean(input.manuallyCompletable);
  const { resolved, ...task } = input;
  const status = resolved || manuallyCompleted ? "completed" : state?.dismissedAt ? "dismissed" : snoozed ? "snoozed" : input.notificationAt <= now ? "needs-attention" : "upcoming";
  return { ...task, status, dismissible: status !== "completed", manuallyCompletable: Boolean(input.manuallyCompletable) };
}

export function nextTaskNotificationAt(task: AssistantTask, document: RentalDocument, now = new Date()): Date | null {
  if (task.status === "completed" || task.status === "dismissed") return null;
  const state = document.taskStates.find((item) => item.taskId === task.id);
  if (task.status === "snoozed") return state?.snoozedUntil ? new Date(state.snoozedUntil) : null;
  return task.notificationAt > now ? task.notificationAt : null;
}

export function taskNotificationPlan(document: RentalDocument, now = new Date()) {
  const cutoff = addDays(now, 90);
  return deriveTasks(document, now).flatMap((task) => {
    const category = ({ TENANT_PAYMENT_CHECK: "rent", TAX_PAYMENT: "tax", RECURRING_BILL: "bills", RENTAL_AGREEMENT_END: "agreements", CUSTOM_REMINDER: "custom" } as const)[task.type];
    if (!document.settings.reminderCategories[category]) return [];
    if (task.type === "TENANT_PAYMENT_CHECK" && !document.properties.find((property) => property.id === task.propertyId)?.paymentReminderEnabled) return [];
    if (task.type === "RECURRING_BILL" && !document.recurringBills.find((bill) => bill.id === task.id.split(":")[1])?.reminderEnabled) return [];
    const routeCategory = ({ TENANT_PAYMENT_CHECK: "rent", TAX_PAYMENT: "tax", RECURRING_BILL: "bill", RENTAL_AGREEMENT_END: "agreement", CUSTOM_REMINDER: "custom" } as const)[task.type];
    const state = document.taskStates.find((item) => item.taskId === task.id);
    const activelySnoozed = Boolean(state?.snoozedUntil && new Date(state.snoozedUntil) > now);
    if (task.type === "RENTAL_AGREEMENT_END" && !activelySnoozed && task.status !== "completed" && task.status !== "dismissed") {
      const property = document.properties.find((item) => item.id === task.propertyId);
      const offsets = property?.rentalEndReminderDays?.length ? property.rentalEndReminderDays : [30];
      return offsets.flatMap((days) => {
        const fireAt = addDays(task.dueAt, -days);
        if (fireAt <= now || fireAt > cutoff) return [];
        const key = `${task.id}:${days}`;
        const title = days ? `Umowa najmu kończy się za ${days} dni` : "Umowa najmu kończy się dzisiaj";
        const body = "Otwórz Ryczałt, aby sprawdzić szczegóły terminu.";
        return [{ key, signature: `${title}|${body}|${fireAt.getTime()}`, title, body, fireAt,
          data: { category: routeCategory, propertyId: task.propertyId, taskId: task.id } }];
      });
    }
    const fireAt = nextTaskNotificationAt(task, document, now);
    if (!fireAt || fireAt <= now) return [];
    if (task.status !== "snoozed" && task.type !== "CUSTOM_REMINDER" && fireAt > cutoff) return [];
    const key = task.id;
    const displayText = {
      TENANT_PAYMENT_CHECK: ["Sprawdź wpłatę czynszu", "Otwórz Ryczałt, aby sprawdzić status wpłaty."],
      TAX_PAYMENT: ["Sprawdź płatność podatku", "Otwórz Ryczałt, aby sprawdzić status płatności."],
      RECURRING_BILL: ["Sprawdź płatność rachunku", "Otwórz Ryczałt, aby sprawdzić szczegóły rachunku."],
      CUSTOM_REMINDER: ["Masz przypomnienie", "Otwórz Ryczałt, aby zobaczyć szczegóły."],
      RENTAL_AGREEMENT_END: ["Sprawdź termin umowy najmu", "Otwórz Ryczałt, aby sprawdzić szczegóły terminu."],
    } as const;
    const [title, body] = displayText[task.type];
    return [{ key, signature: `${title}|${body}|${fireAt.getTime()}`, title, body, fireAt,
      data: { category: routeCategory, propertyId: task.propertyId, period: task.period,
        billId: task.type === "RECURRING_BILL" ? task.id.split(":")[1] : undefined,
        expectedAmount: task.type === "TENANT_PAYMENT_CHECK" && task.remainingGrosz !== undefined ? (task.remainingGrosz / 100).toFixed(2) : undefined,
        taskId: task.id } }];
  }).sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, 60);
}

export type ReturnTypeTaskNotification = ReturnType<typeof taskNotificationPlan>[number];

export function setTaskState(states: TaskState[], taskId: string, change: Partial<Omit<TaskState, "taskId">>): TaskState[] {
  const previous = states.find((item) => item.taskId === taskId);
  const next = { ...(previous ?? { taskId }), ...change };
  return [...states.filter((item) => item.taskId !== taskId), next];
}

export function snoozeOptions(now = new Date()) {
  return [1, 3, 7].map((days) => ({ days, until: addDays(now, days) }));
}

export function localIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthOf(date: Date) { return localIso(date).slice(0, 7); }
function shiftMonth(month: string, offset: number) { const [y, m] = month.split("-").map(Number); return `${new Date(y!, m! - 1 + offset, 1).getFullYear()}-${String(new Date(y!, m! - 1 + offset, 1).getMonth() + 1).padStart(2, "0")}`; }
function paymentDay(month: string, day: number) { const [y, m] = month.split("-").map(Number); return new Date(y!, m! - 1, Math.min(day, new Date(y!, m!, 0).getDate()), 9); }
function localDate(value: string) { const [y, m, d] = value.split("-").map(Number); return new Date(y!, m! - 1, d!, 9); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function monthLabel(month: string) { const [y, m] = month.split("-").map(Number); return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(y!, m! - 1, 1)); }
function periodLabel(period: string) { const quarter = period.match(/^\d{4}-Q([1-4])$/); return quarter ? `${quarter[1]}. kwartał ${period.slice(0, 4)}` : monthLabel(period); }
function formatDate(value: string) { return new Intl.DateTimeFormat("pl-PL").format(localDate(value)); }
