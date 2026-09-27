import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { deriveTasks, localIso, rentMonthAmounts, setTaskState, snoozeOptions, type AssistantTask } from "../domain/tasks";
import { calculateSettlements, formatPln, moneyToGrosz } from "../domain/ryczaltTax";
import { isValidCalendarDate } from "../domain/rentalValidation";
import { deriveSetupProgress, type SetupAction } from "../domain/setupProgress";
import { setupActionIntent } from "../navigation/setupIntent";
import { recurringBillTaskIntent } from "../navigation/billIntent";
import type { CustomReminder, Property, ReminderRecurrence } from "../model/rental";
import { deleteCustomReminder, findCustomReminderForTask, recurrenceLabel, saveCustomReminder } from "../domain/customReminders";
import { useReminders } from "../notifications/ReminderProvider";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { TaskRow } from "../components/pulpit/TaskRow";
import { historicalTasks, primaryDashboardMetrics, rentDisplayState, upcomingTasks } from "../domain/rentalPresentation";

export function PulpitScreen() {
  const { document, update } = useRentalData();
  const { permission } = useReminders();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskSectionY, setTaskSectionY] = useState(0);
  const [adminPickerVisible, setAdminPickerVisible] = useState(false);
  const [snoozeTask, setSnoozeTask] = useState<AssistantTask | null>(null);
  const [snoozeDate, setSnoozeDate] = useState(todayIsoDate());
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDate, setCustomDate] = useState(todayIsoDate());
  const [customNote, setCustomNote] = useState("");
  const [customPropertyId, setCustomPropertyId] = useState("");
  const [customReminderId, setCustomReminderId] = useState("");
  const [customRecurrence, setCustomRecurrence] = useState<ReminderRecurrence>("ONCE");
  const [customTaskDone, setCustomTaskDone] = useState(false);
  const [customTaskId, setCustomTaskId] = useState("");
  const tasks = useMemo(() => document ? deriveTasks(document) : [], [document]);
  const setup = useMemo(() => document ? deriveSetupProgress(document) : null, [document]);
  const taskListRef = useRef<ScrollView>(null);

  useEffect(() => {
    const taskId = (route.params as { taskId?: string } | undefined)?.taskId;
    if (!document || !taskId) return;
    const reminder = findCustomReminderForTask(document.customReminders, taskId);
    if (reminder) {
      setCustomTaskId(taskId); setCustomReminderId(reminder.id); setCustomTaskDone(false); setCustomTitle(reminder.title); setCustomDate(reminder.dueDate); setCustomRecurrence(reminder.recurrence);
      setCustomNote(reminder.note ?? ""); setCustomPropertyId(reminder.propertyId ?? ""); setCustomOpen(true);
    }
    navigation.setParams({ taskId: undefined });
  }, [document, navigation, route.params]);

  if (!document) return <View style={ui.page} />;
  const now = new Date();
  const attention = tasks.filter((task) => task.status === "needs-attention");
  const history = historicalTasks(tasks);
  const settlements = [2025, 2026].includes(document.settings.taxYear) ? calculateSettlements({
    entries: document.incomeEntries, payments: document.taxPayments, taxYear: document.settings.taxYear,
    mode: document.settings.settlementMode, jointSpouseThreshold: document.settings.jointSpouseThreshold,
  }) : [];
  const selectedMonth = todayIsoDate().slice(0, 7);
  const monthIncome = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(selectedMonth))
    .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
  const remainingRent = document.properties.reduce((sum, property) => {
    const amounts = rentMonthAmounts(property, document.incomeEntries, selectedMonth, now);
    return sum + (amounts.remainingGrosz ?? 0);
  }, 0);
  const upcoming = upcomingTasks(tasks, now);
  const currentPeriod = settlements.find((item) => item.period === selectedMonth);

  const setState = (taskId: string, change: { snoozedUntil?: string; dismissedAt?: string; completedAt?: string }) => {
    void update((current) => ({ ...current, taskStates: setTaskState(current.taskStates, taskId, change) })).catch(() => undefined);
  };
  const openTask = (task: AssistantTask) => {
    if (task.type === "TENANT_PAYMENT_CHECK") navigation.navigate("Przychód", {
      quickAdd: true, propertyId: task.propertyId, rentalMonth: task.period,
      expectedAmount: task.remainingGrosz ? (task.remainingGrosz / 100).toFixed(2) : undefined,
    });
    else if (task.type === "TAX_PAYMENT") navigation.navigate("Podatek", { period: task.period });
    else if (task.type === "RECURRING_BILL") navigation.navigate("Ustawienia", recurringBillTaskIntent(task.id.split(":")[1]!, task.period!));
    else if (task.type === "RENTAL_AGREEMENT_END") navigation.navigate("Ustawienia", { propertyId: task.propertyId });
    else {
      setCustomTaskId(task.id);
      const reminder = findCustomReminderForTask(document.customReminders, task.id);
      setCustomReminderId(reminder?.id ?? "");
      setCustomTaskDone(task.status === "completed");
      setCustomTitle(reminder?.title ?? task.title);
      setCustomDate(reminder?.dueDate ?? localIso(task.dueAt));
      setCustomRecurrence(reminder?.recurrence ?? "ONCE");
      setCustomNote(reminder?.note ?? "");
      setCustomPropertyId(reminder?.propertyId ?? "");
      setCustomOpen(true);
    }
  };
  const addIncome = () => navigation.navigate("Przychód", { quickAdd: true });
  const openAdministration = (property?: Property) => {
    const linked = document.properties.filter((item) => item.administratorPortalUrl || document.propertyLinks.some((link) => link.propertyId === item.id && link.category === "ADMINISTRATION"));
    if (property) {
      const url = property.administratorPortalUrl ?? document.propertyLinks.find((link) => link.propertyId === property.id && link.category === "ADMINISTRATION")?.url;
      if (url) void Linking.openURL(url).catch(() => Alert.alert("Nie można otworzyć portalu", "Sprawdź zapisany adres HTTPS."));
      else navigation.navigate("Ustawienia", { propertyId: property.id });
      return;
    }
    if (linked.length === 1) { openAdministration(linked[0]); return; }
    if (linked.length > 1) setAdminPickerVisible(true);
    else navigation.navigate("Ustawienia");
  };
  const openCustom = () => {
    setCustomTaskDone(false); setCustomTaskId(""); setCustomTitle(""); setCustomDate(todayIsoDate()); setCustomNote("");
    setCustomPropertyId(""); setCustomReminderId(""); setCustomRecurrence("ONCE"); setCustomOpen(true);
  };
  const saveCustom = async () => {
    if (!customTitle.trim() || !isValidCalendarDate(customDate)) {
      Alert.alert("Sprawdź przypomnienie", "Wpisz tytuł i prawidłową datę RRRR-MM-DD."); return;
    }
    const item: CustomReminder = { id: customReminderId || createId("reminder"), title: customTitle.trim(), dueDate: customDate, recurrence: customRecurrence,
      ...(customPropertyId ? { propertyId: customPropertyId } : {}), ...(customNote.trim() ? { note: customNote.trim() } : {}) };
    try {
      await update((current) => saveCustomReminder(current, item, customTaskId || undefined));
      setCustomOpen(false);
    } catch { /* The data provider surfaces save failures. */ }
  };
  const saveSnooze = (until: Date) => {
    if (!snoozeTask) return;
    setState(snoozeTask.id, { snoozedUntil: until.toISOString(), dismissedAt: undefined, completedAt: undefined });
    setSnoozeTask(null);
  };
  const manualComplete = (task: AssistantTask) => Alert.alert("Oznaczyć jako załatwione?", task.title, [
    { text: "Anuluj", style: "cancel" },
    { text: "Oznacz", onPress: () => setState(task.id, { completedAt: new Date().toISOString(), dismissedAt: undefined, snoozedUntil: undefined }) },
  ]);
  const openSetupAction = (action: SetupAction, propertyId?: string) => {
    const intent = setupActionIntent(action, propertyId);
    navigation.navigate(intent.screen, intent.params);
  };

  if (document.properties.length === 0) return <View style={ui.page}>
    <ScrollView contentContainerStyle={ui.content}>
      <Text style={pageTitle}>Pulpit</Text>
      <View accessibilityLabel="Skonfiguruj pierwszy najem" style={setupCard}>
        <Text style={setupTitle}>Skonfiguruj pierwszy najem</Text>
        <Text style={muted}>Dodaj mieszkanie, aby zapisać oczekiwany czynsz i terminy. Wpłaty ani płatności nie zostaną utworzone automatycznie.</Text>
        <Pressable accessibilityRole="button" onPress={() => openSetupAction("apartment")} style={primaryButton}><Text style={primaryText}>Dodaj mieszkanie</Text></Pressable>
      </View>
      {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne w Pulpit.</Text> : null}
    </ScrollView>
  </View>;

  return <View style={ui.page}>
    <ScrollView ref={taskListRef} contentContainerStyle={ui.content}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View><Text style={pageTitle}>Pulpit</Text><Text style={muted}>Dzień dobry</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dodaj osobiste przypomnienie" onPress={openCustom} style={iconButton}><Text style={action}>＋</Text></Pressable>
      </View>


      <Text style={{ ...sectionTitle, marginTop: 12 }}>{monthLabel(selectedMonth)}</Text>
      <View style={kpiGrid}>
        {primaryDashboardMetrics(compactPln(monthIncome), compactPln(remainingRent), currentPeriod ? `${compactPln(currentPeriod.outstandingGrosz)} · ${new Date(`${currentPeriod.dueDate}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}` : "—").map((metric) => <Kpi key={metric.label} label={metric.label} value={metric.value} />)}
      </View>
      <Pressable accessibilityRole="button" onPress={() => taskListRef.current?.scrollTo({ y: taskSectionY, animated: true })} style={attentionSummary}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{attention.length ? `${attention.length} ${attention.length === 1 ? "sprawa wymaga" : "sprawy wymagają"} uwagi` : "Nie ma spraw wymagających uwagi"}</Text>
        <Text style={action}>Pokaż</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={addIncome} style={primaryButton}><Text style={primaryText}>＋ Potwierdź wpłatę</Text></Pressable>

      <View style={sectionHeader}><Text style={sectionTitle}>Mieszkania</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia")}><Text style={action}>Ustawienia ›</Text></Pressable></View>
      {!document.properties.length ? <View style={emptyRow}><Text style={emptyText}>Dodaj mieszkanie, aby zobaczyć czynsz i terminy.</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia")}><Text style={action}>Dodaj mieszkanie</Text></Pressable></View> : document.properties.map((property) => {
        const amount = rentMonthAmounts(property, document.incomeEntries, selectedMonth, now);
        const paymentState = rentDisplayState(amount.expectedGrosz, amount.confirmedGrosz, amount.remainingGrosz);
        const links = document.propertyLinks.filter((link) => link.propertyId === property.id);
        return <View key={property.id} style={[ui.card, propertyRow]}>
          <View style={propertyHeader}><View style={{ flex: 1 }}><Text style={propertyName}>{property.name}</Text>{property.tenantName ? <Text style={muted}>{property.tenantName}</Text> : null}</View>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { propertyId: property.id })}><Text style={action}>Edytuj</Text></Pressable></View>
          {paymentState.kind === "unknown" ? <Text style={muted}>Oczekiwany czynsz nieustalony</Text>
            : paymentState.kind === "paid" ? <View style={propertyPaymentState}><Text style={paidLabel}>✓ {monthLabel(selectedMonth)} opłacony</Text><Text style={metricValue}>{formatPln(paymentState.expectedGrosz)}</Text></View>
              : paymentState.kind === "partial" ? <View style={{ marginTop: 8 }}><Text style={muted}>Częściowo opłacone · {formatPln(paymentState.confirmedGrosz)} / {formatPln(paymentState.expectedGrosz)}</Text><Text style={metricValue}>Pozostało {formatPln(paymentState.remainingGrosz)}</Text></View>
                : <View style={{ marginTop: 8 }}><Text style={muted}>Do potwierdzenia</Text><Text style={metricValue}>{formatPln(paymentState.remainingGrosz)}</Text>{property.expectedPaymentDay ? <Text style={muted}>Termin: {property.expectedPaymentDay}. {new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(new Date(`${selectedMonth}-01T12:00:00`))}</Text> : null}</View>}
          {property.rentalEndDate ? <Text style={muted}>Koniec umowy · {property.rentalEndDate}</Text> : null}
          {property.administratorPortalUrl || links.length ? <View style={quickRow}>
            {property.administratorPortalUrl ? <Pressable accessibilityRole="link" onPress={() => openAdministration(property)}><Text style={action}>Otwórz panel administracji</Text></Pressable> : null}
            {links.map((link) => <Pressable key={link.id} accessibilityRole="link" onPress={() => void Linking.openURL(link.url)}><Text style={action}>{link.label}</Text></Pressable>)}
          </View> : null}
        </View>;
      })}

      <View onLayout={(event) => setTaskSectionY(event.nativeEvent.layout.y)} style={sectionHeader}><Text style={sectionTitle}>Do zrobienia</Text></View>
      {attention.length ? attention.map((task) => <TaskRow key={task.id} task={task} onOpen={() => openTask(task)} onSnooze={() => { setSnoozeDate(localIso(snoozeOptions(now)[0]!.until)); setSnoozeTask(task); }} onDismiss={() => setState(task.id, { dismissedAt: new Date().toISOString(), snoozedUntil: undefined })} onComplete={() => manualComplete(task)} />)
        : <Text style={emptyText}>Wszystko na dziś załatwione.</Text>}
      {upcoming.length ? <><Text style={sectionTitle}>Nadchodzące</Text>{upcoming.map((task) => <TaskRow key={task.id} task={task} compact onOpen={() => openTask(task)} onSnooze={() => { setSnoozeDate(localIso(snoozeOptions(now)[0]!.until)); setSnoozeTask(task); }} onDismiss={() => setState(task.id, { dismissedAt: new Date().toISOString(), snoozedUntil: undefined })} onComplete={() => manualComplete(task)} />)}</> : null}
      {history.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: historyOpen }} onPress={() => setHistoryOpen((open) => !open)} style={historyLink}><Text style={action}>{historyOpen ? "Ukryj historię" : `Historia · ${history.length}`}</Text><Text style={action}>{historyOpen ? "⌃" : "›"}</Text></Pressable> : null}
      {historyOpen ? history.map((task) => <TaskRow key={task.id} task={task} onOpen={() => openTask(task)} onSnooze={() => {}} onDismiss={() => {}} onComplete={() => {}} />) : null}

      {setup?.showGuidance && setup.nextAction ? <SetupCard
        action={setup.nextAction.action}
        label={setup.nextAction.label}
        propertyName={setup.nextAction.propertyName}
        completed={setup.completedRequiredSteps}
        total={setup.totalRequiredSteps}
        onPress={() => openSetupAction(setup.nextAction!.action, setup.nextAction!.propertyId)}
      /> : null}
      {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne w Pulpit.</Text> : null}



    </ScrollView>

    <Modal visible={Boolean(snoozeTask)} transparent animationType="fade" onRequestClose={() => setSnoozeTask(null)}>
      <View style={modalBackdrop}><View style={modalPanel}><ModalHeader title="Przypomnij później" onClose={() => setSnoozeTask(null)} />
        <Text style={muted}>Termin zadania i zobowiązanie pozostają bez zmian.</Text>
        {snoozeOptions(now).map(({ days, until }) => <Pressable key={days} accessibilityRole="button" onPress={() => saveSnooze(until)} style={modalAction}><Text style={action}>{days === 1 ? "Jutro" : days === 3 ? "Za 3 dni" : "Za tydzień"} · {until.toLocaleDateString("pl-PL")}</Text></Pressable>)}
        <Text style={smallLabel}>Wybierz własną datę (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Data przypomnienia" value={snoozeDate} onChangeText={setSnoozeDate} style={input} />
        <Pressable accessibilityRole="button" onPress={() => {
          const until = new Date(`${snoozeDate}T09:00:00`);
          if (!isValidCalendarDate(snoozeDate) || until <= new Date()) Alert.alert("Nieprawidłowa data", "Wybierz przyszłą datę przypomnienia.");
          else saveSnooze(until);
        }} style={primaryButton}><Text style={primaryText}>Ustaw przypomnienie</Text></Pressable>
      </View></View>
    </Modal>

    <Modal visible={customOpen} animationType="slide" onRequestClose={() => setCustomOpen(false)}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}><ModalHeader title={customTaskId ? "Przypomnienie" : "Nowe przypomnienie"} onClose={() => setCustomOpen(false)} />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={smallLabel}>Tytuł</Text><TextInput accessibilityLabel="Tytuł przypomnienia" value={customTitle} onChangeText={setCustomTitle} style={input} />
          <Text style={smallLabel}>Termin (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Termin przypomnienia" value={customDate} onChangeText={setCustomDate} style={input} />
          <Text style={smallLabel}>Powtarzanie</Text><View style={chartFilter}>{([
            ["ONCE", "Jednorazowo"], ["MONTHLY", "Co miesiąc"], ["YEARLY", "Co rok"],
          ] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: customRecurrence === value }} onPress={() => setCustomRecurrence(value)} style={[filterButton, customRecurrence === value && selectedFilter]}><Text style={filterText}>{label}</Text></Pressable>)}</View>
          {customRecurrence !== "ONCE" && isValidCalendarDate(customDate) ? <Text style={muted}>{recurrenceLabel(customRecurrence, customDate)}</Text> : null}
          <Text style={smallLabel}>Mieszkanie (opcjonalnie)</Text><View style={chartFilter}>{document.properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: customPropertyId === property.id }} onPress={() => setCustomPropertyId(customPropertyId === property.id ? "" : property.id)} style={[filterButton, customPropertyId === property.id && selectedFilter]}><Text style={filterText}>{property.name}</Text></Pressable>)}</View>
          <Text style={smallLabel}>Notatka (opcjonalnie)</Text><TextInput accessibilityLabel="Notatka przypomnienia" value={customNote} onChangeText={setCustomNote} multiline style={[input, { minHeight: 88, textAlignVertical: "top" }]} />
          {customTaskId ? <><Pressable accessibilityRole="button" onPress={() => void saveCustom()} style={secondaryButton}><Text style={buttonText}>Zapisz zmiany</Text></Pressable>
            {!customTaskDone ? <Pressable accessibilityRole="button" onPress={() => { setState(customTaskId, { completedAt: new Date().toISOString() }); setCustomOpen(false); }} style={secondaryButton}><Text style={buttonText}>Oznacz jako załatwione</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => Alert.alert("Usunąć przypomnienie?", customTitle, [{ text: "Anuluj", style: "cancel" }, { text: "Usuń", style: "destructive", onPress: () => { const id = customReminderId; void update((current) => deleteCustomReminder(current, id)).catch(() => undefined); setCustomOpen(false); } }])} style={destructiveButton}><Text style={dangerText}>Usuń przypomnienie</Text></Pressable></>
            : <Pressable accessibilityRole="button" onPress={() => void saveCustom()} style={primaryButton}><Text style={primaryText}>Zapisz przypomnienie</Text></Pressable>}
        </ScrollView>
      </View>
    </Modal>

    <Modal visible={adminPickerVisible} transparent animationType="fade" onRequestClose={() => setAdminPickerVisible(false)}>
      <View style={modalBackdrop}><View style={modalPanel}><ModalHeader title="Administracja" onClose={() => setAdminPickerVisible(false)} />
        {document.properties.filter((item) => item.administratorPortalUrl || document.propertyLinks.some((link) => link.propertyId === item.id && link.category === "ADMINISTRATION")).map((property) => <Pressable key={property.id} accessibilityRole="button" onPress={() => { setAdminPickerVisible(false); openAdministration(property); }} style={modalAction}><Text style={action}>{property.name}</Text></Pressable>)}
      </View></View>
    </Modal>
  </View>;
}

function SetupCard({ action, label, propertyName, completed, total, onPress }: { action: SetupAction; label: string; propertyName?: string; completed: number; total: number; onPress: () => void }) {
  const context = action === "payment-reminder" ? label : propertyName ? `${propertyName} — ${label.toLocaleLowerCase("pl-PL")}` : label;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${completed} z ${total} kroków konfiguracji: ${context}`} onPress={onPress} style={setupReminderRow}>
    <Text style={{ color: theme.colors.textSecondary, flex: 1 }}>{context}</Text><Text style={actionStyle}>›</Text>
  </Pressable>;
}
function Kpi({ label, value }: { label: string; value: string }) { return <View style={kpi}><Text style={kpiLabel}>{label}</Text><Text style={kpiValue}>{value}</Text></View>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={modalHeader}><Text style={modalTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={action}>Zamknij</Text></Pressable></View>; }
function monthLabel(month: string) { const [year, number] = month.split("-").map(Number); return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(year!, number! - 1, 1)); }
function compactPln(amountGrosz: number) { return formatPln(amountGrosz).replace(/,00(?= zł)/, ""); }

const pageTitle = { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700" as const };
const setupCard = { ...ui.card, marginTop: 14 };
const setupTitle = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const, marginTop: 5 };
const sectionTitle = ui.sectionTitle;
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const smallLabel = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" as const };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };
const sectionHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 12 };
const emptyText = { color: theme.colors.textSecondary, backgroundColor: theme.colors.surface, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 15, marginVertical: 6, fontSize: 14 };
const quickRow = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginVertical: 8 };
const kpiGrid = { flexDirection: "row" as const, gap: 6, marginVertical: 9 };
const kpi = { flex: 1, minHeight: 72, backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderWidth: 1, borderRadius: 16, padding: 9, justifyContent: "space-between" as const, elevation: 1 };
const kpiLabel = { color: theme.colors.textSecondary, fontSize: 12 };
const kpiValue = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "700" as const, marginTop: 6 };
const chartFilter = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginVertical: 8 };
const filterButton = { borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.surface };
const selectedFilter = { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.primary };
const filterText = { color: theme.colors.textPrimary, fontSize: 11 };
const propertyRow = { paddingVertical: 14, marginTop: 5 };
const propertyHeader = { flexDirection: "row" as const, alignItems: "flex-start" as const, justifyContent: "space-between" as const, gap: 12, marginBottom: 4 };
const propertyName = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const };
const metricValue = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" as const };
const paidLabel = { color: theme.colors.success, fontWeight: "700" as const, fontSize: 14 };
const propertyPaymentState = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginTop: 8 };
const attentionSummary = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginVertical: 6 };
const historyLink = { minHeight: 48, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingHorizontal: 4 };
const setupReminderRow = { minHeight: 44, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingHorizontal: 4 };
const actionStyle = { color: theme.colors.primary, fontWeight: "700" as const };
const emptyRow = { gap: 7, marginTop: 4 };
const iconButton = { width: 42, height: 42, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 14, backgroundColor: theme.colors.accentSoft };
const modalBackdrop = { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center" as const, padding: 18 };
const modalPanel = { backgroundColor: theme.colors.modalBackground, borderRadius: 18, padding: 18, maxHeight: "85%" as const };
const modalHeader = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const modalTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 18 };
const modalAction = { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const input = { borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, borderRadius: 12, minHeight: 46, paddingHorizontal: 11, marginTop: 6, marginBottom: 12 };
const primaryButton = { ...ui.primaryButton, marginTop: 10 };
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const };
const secondaryButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, marginTop: 9 };
const buttonText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const destructiveButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 8, marginTop: 9 };
const dangerText = { color: theme.colors.danger, fontWeight: "600" as const };
