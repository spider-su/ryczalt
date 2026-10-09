import { calculateSettlements, formatPln, hasTaxRulesForYear, moneyToGrosz } from "./ryczaltTax";
import { taxSettlementFromSnapshot } from "./periodSnapshots";
import type { RentalDocument, TaskState } from "../model/rental";
import { rentMonthAmounts } from "./rentAllocation";
import { formatPolishDate, formatPolishMonth } from "./presentationFormat";
import { effectivePaymentDay } from "./apartmentTerms";
import { lifecycleForMonth } from "./apartmentLifecycle";
export { expectedRentForMonth, rentMonthAmounts } from "./rentAllocation";

export type TaskType = "TENANT_PAYMENT_CHECK" | "TAX_PAYMENT" | "RENTAL_AGREEMENT_END";
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
export type TaskNotification = {
  key: string;
  signature: string;
  title: string;
  body: string;
  fireAt: Date;
  data: { category: "rent" | "tax" | "agreement"; propertyId?: string; period?: string; taskId?: string; taskIds?: string[] };
};
export type ReturnTypeTaskNotification = TaskNotification;

export function groupActiveTasks(tasks: AssistantTask[]) {
  return {
    actionable: tasks.filter((task) => task.status === "needs-attention"),
    upcoming: tasks.filter((task) => task.status === "upcoming" || task.status === "snoozed"),
  };
}

export function deriveTasks(document: RentalDocument, now = new Date()): AssistantTask[] {
  const tasks: AssistantTask[] = [];
  const current = monthOf(now);
  for (const property of document.properties) {
    const dueDay = effectivePaymentDay(property, current);
    if (dueDay) {
      for (let offset = -2; offset <= 6; offset++) {
        const period = shiftMonth(current, offset);
        if (lifecycleForMonth(property, period) !== "ACTIVE") continue;
        const amounts = rentMonthAmounts(property, document.incomeEntries, period, now);
        if (amounts.expectedGrosz === null || amounts.expectedGrosz === 0 || amounts.remainingGrosz === null) continue;
        const dueAt = paymentDay(period, effectivePaymentDay(property, period));
        const notificationAt = addDays(dueAt, document.settings.rentReminderDelayDays);
        const remaining = amounts.remainingGrosz;
        const done = remaining === 0;
        const title = done ? `Czynsz potwierdzony — ${property.address}` : `Sprawdź czynsz — ${property.address}`;
        const detail = `Za ${monthLabel(period)}: oczekiwano ${formatPln(amounts.expectedGrosz)}, potwierdzono ${formatPln(amounts.confirmedGrosz)}${remaining ? `, do potwierdzenia ${formatPln(remaining)}` : ""}.`;
        tasks.push(makeTask(document, now, {
          id: `TENANT_PAYMENT_CHECK:${property.id}:${period}`, type: "TENANT_PAYMENT_CHECK", title, detail,
          propertyId: property.id, period, dueAt, notificationAt, attentionAt: dueAt, expectedGrosz: amounts.expectedGrosz,
          confirmedGrosz: amounts.confirmedGrosz, remainingGrosz: remaining, resolved: done,
        }));
      }
    }
    if (property.leaseEndDate && lifecycleForMonth(property, current) === "ACTIVE") {
      const dueAt = localDate(property.leaseEndDate);
      const notificationAt = addDays(dueAt, -30);
      tasks.push(makeTask(document, now, {
        id: `RENTAL_AGREEMENT_END:${property.id}:${property.leaseEndDate}`, type: "RENTAL_AGREEMENT_END",
        title: `Umowa najmu — ${property.address}`, detail: `Umowa kończy się ${formatDate(property.leaseEndDate)}.`,
        propertyId: property.id, dueAt, notificationAt, resolved: false, manuallyCompletable: true,
      }));
    }
  }

  if (hasTaxRulesForYear(document.settings.taxYear)) {
    const savedTaxPeriods = (document.taxSettlementSnapshots ?? []).filter((snapshot) => snapshot.rulesYear === document.settings.taxYear);
    const calculatedSettlements = calculateSettlements({ entries: document.incomeEntries, payments: document.taxPayments,
      taxYear: document.settings.taxYear, mode: document.settings.settlementMode,
      jointSpouseThreshold: document.settings.jointSpouseThreshold,
      openingTaxableRevenueGrosz: document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0,
      openingTaxPaidGrosz: document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0,
      today: localIso(now) });
    const savedByPeriod = new Map(savedTaxPeriods.map((snapshot) => [snapshot.period, snapshot]));
    const settlements = calculatedSettlements.map((settlement) => {
      const snapshot = savedByPeriod.get(settlement.period);
      return snapshot ? taxSettlementFromSnapshot(snapshot, localIso(now)) : settlement;
    });
    for (const settlement of settlements) {
      if (settlement.obligationGrosz <= 0) continue;
      const dueAt = localDate(settlement.dueDate);
      const notificationAt = addDays(dueAt, -3);
      tasks.push(makeTask(document, now, {
        id: `TAX_PAYMENT:${settlement.period}`, type: "TAX_PAYMENT",
        title: settlement.outstandingGrosz ? `Podatek za ${periodLabel(settlement.period)}` : `Podatek opłacony — ${periodLabel(settlement.period)}`,
        detail: `Należny podatek ${formatPln(settlement.obligationGrosz)}, zapłacono ${formatPln(settlement.allocatedPaidGrosz)}, pozostało do zapłaty ${formatPln(settlement.outstandingGrosz)}. Termin ${formatDate(settlement.dueDate)}.`,
        period: settlement.period, dueAt, notificationAt, expectedGrosz: settlement.obligationGrosz,
        confirmedGrosz: settlement.allocatedPaidGrosz, remainingGrosz: settlement.outstandingGrosz,
        resolved: settlement.outstandingGrosz === 0,
      }));
    }
  }

  return tasks.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

function makeTask(document: RentalDocument, now: Date, input: Omit<AssistantTask, "status" | "dismissible" | "manuallyCompletable"> & { resolved: boolean; manuallyCompletable?: boolean; attentionAt?: Date }): AssistantTask {
  const state = document.taskStates.find((item) => item.taskId === input.id);
  const activeSnooze = state?.snoozedUntil ? new Date(state.snoozedUntil) : undefined;
  const snoozed = !input.resolved && activeSnooze !== undefined && activeSnooze > now;
  const manuallyCompleted = Boolean(state?.completedAt) && Boolean(input.manuallyCompletable);
  const { resolved, attentionAt, ...task } = input;
  const status = resolved || manuallyCompleted ? "completed" : state?.dismissedAt ? "dismissed" : snoozed ? "snoozed" : (attentionAt ?? input.notificationAt) <= now ? "needs-attention" : "upcoming";
  return { ...task, status, dismissible: status !== "completed", manuallyCompletable: Boolean(input.manuallyCompletable) };
}

export function nextTaskNotificationAt(task: AssistantTask, document: RentalDocument, now = new Date()): Date | null {
  if (task.status === "completed" || task.status === "dismissed") return null;
  const state = document.taskStates.find((item) => item.taskId === task.id);
  if (task.status === "snoozed") return state?.snoozedUntil ? new Date(state.snoozedUntil) : null;
  return task.notificationAt > now ? task.notificationAt : null;
}

export function taskNotificationPlan(document: RentalDocument, now = new Date()): TaskNotification[] {
  const cutoff = addDays(now, 90);
  const tasks = deriveTasks(document, now);
  const notifications: TaskNotification[] = [];
  const rentGroups = new Map<string, AssistantTask[]>();
  for (const task of tasks) {
    const category = ({ TENANT_PAYMENT_CHECK: "rent", TAX_PAYMENT: "tax", RENTAL_AGREEMENT_END: "agreements" } as const)[task.type];
    if (!document.settings.reminderCategories[category]) continue;
    if (task.type === "TENANT_PAYMENT_CHECK") {
      const fireAt = nextTaskNotificationAt(task, document, now);
      if (!fireAt || fireAt > cutoff) continue;
      const groupKey = `${task.period}:${localIso(fireAt)}`;
      rentGroups.set(groupKey, [...(rentGroups.get(groupKey) ?? []), task]);
      continue;
    }
    const routeCategory = ({ TENANT_PAYMENT_CHECK: "rent", TAX_PAYMENT: "tax", RENTAL_AGREEMENT_END: "agreement" } as const)[task.type];
    const state = document.taskStates.find((item) => item.taskId === task.id);
    const activelySnoozed = Boolean(state?.snoozedUntil && new Date(state.snoozedUntil) > now);
    if (task.type === "RENTAL_AGREEMENT_END" && !activelySnoozed && task.status !== "completed" && task.status !== "dismissed") {
      const fireAt = addDays(task.dueAt, -30);
      if (fireAt <= now || fireAt > cutoff) continue;
      const key = `${task.id}:30`;
      const title = "Umowa najmu kończy się za 30 dni";
      const body = "Otwórz Ryczałt, aby sprawdzić szczegóły terminu.";
      notifications.push({ key, signature: `${title}|${body}|${fireAt.getTime()}`, title, body, fireAt,
        data: { category: routeCategory, propertyId: task.propertyId, taskId: task.id } });
      continue;
    }
    const fireAt = nextTaskNotificationAt(task, document, now);
    if (!fireAt || fireAt <= now) continue;
    if (task.status !== "snoozed" && fireAt > cutoff) continue;
    const key = task.id;
    const displayText = {
      TENANT_PAYMENT_CHECK: ["Sprawdź wpłatę czynszu", "Otwórz Ryczałt, aby sprawdzić status wpłaty."],
      TAX_PAYMENT: ["Sprawdź płatność podatku", "Otwórz Ryczałt, aby sprawdzić status płatności."],
      RENTAL_AGREEMENT_END: ["Sprawdź termin umowy najmu", "Otwórz Ryczałt, aby sprawdzić szczegóły terminu."],
    } as const;
    const [title, body] = displayText[task.type];
    notifications.push({ key, signature: `${title}|${body}|${fireAt.getTime()}`, title, body, fireAt,
      data: { category: routeCategory, propertyId: task.propertyId, period: task.period,
        taskId: task.id } });
  }
  for (const [groupKey, group] of rentGroups) {
    const first = group[0]!;
    const fireAt = nextTaskNotificationAt(first, document, now)!;
    const title = "Sprawdź wpłaty czynszu";
    const body = "Otwórz Ryczałt, aby sprawdzić adresy i statusy wpłat.";
    notifications.push({ key: `TENANT_PAYMENT_CHECK:group:${groupKey}`, signature: `${title}|${body}|${fireAt.getTime()}`, title, body, fireAt,
      data: { category: "rent", period: first.period, propertyId: first.propertyId, taskIds: group.map((task) => task.id) } });
  }
  return notifications.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, 60);
}

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
function monthLabel(month: string) { return formatPolishMonth(month); }
function periodLabel(period: string) { const quarter = period.match(/^\d{4}-Q([1-4])$/); return quarter ? `${quarter[1]}. kwartał ${period.slice(0, 4)}` : monthLabel(period); }
function formatDate(value: string) { return formatPolishDate(value, "long"); }
