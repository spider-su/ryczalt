import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { deriveTasks, localIso, rentMonthAmounts, setTaskState, snoozeOptions, type AssistantTask, type TaskStatus } from "../domain/tasks";
import { calculateSettlements, formatPln, moneyToGrosz } from "../domain/ryczaltTax";
import { isValidCalendarDate } from "../domain/rentalValidation";
import type { CustomReminder, Property } from "../model/rental";
import { theme } from "../theme/theme";

type TaskView = "active" | "completed" | "dismissed";
const taskTypeLabel: Record<AssistantTask["type"], string> = {
  TENANT_PAYMENT_CHECK: "Czynsz", TAX_PAYMENT: "Podatek", RECURRING_BILL: "Rachunek",
  RENTAL_AGREEMENT_END: "Umowa", CUSTOM_REMINDER: "Osobiste",
};

export function PulpitScreen() {
  const { document, update } = useRentalData();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [view, setView] = useState<TaskView>("active");
  const [selectedMonth, setSelectedMonth] = useState(todayIsoDate().slice(0, 7));
  const [chartPropertyId, setChartPropertyId] = useState<string | null>(null);
  const [adminPickerVisible, setAdminPickerVisible] = useState(false);
  const [snoozeTask, setSnoozeTask] = useState<AssistantTask | null>(null);
  const [snoozeDate, setSnoozeDate] = useState(todayIsoDate());
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDate, setCustomDate] = useState(todayIsoDate());
  const [customNote, setCustomNote] = useState("");
  const [customPropertyId, setCustomPropertyId] = useState("");
  const [customTaskDone, setCustomTaskDone] = useState(false);
  const [customTaskId, setCustomTaskId] = useState("");
  const tasks = useMemo(() => document ? deriveTasks(document) : [], [document]);

  useEffect(() => {
    const taskId = (route.params as { taskId?: string } | undefined)?.taskId;
    if (!document || !taskId) return;
    const reminder = document.customReminders.find((item) => `CUSTOM_REMINDER:${item.id}` === taskId);
    if (reminder) {
      setCustomTaskId(taskId); setCustomTaskDone(false); setCustomTitle(reminder.title); setCustomDate(reminder.dueDate);
      setCustomNote(reminder.note ?? ""); setCustomPropertyId(reminder.propertyId ?? ""); setCustomOpen(true);
    }
    navigation.setParams({ taskId: undefined });
  }, [document, navigation, route.params]);

  if (!document) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  const now = new Date();
  const attention = tasks.filter((task) => task.status === "needs-attention");
  const filteredTasks = view === "active" ? tasks.filter((task) => ["needs-attention", "upcoming", "snoozed"].includes(task.status))
    : tasks.filter((task) => task.status === (view === "completed" ? "completed" : "dismissed"));
  const shownTasks = view === "active"
    ? [...filteredTasks.filter((task) => task.status === "needs-attention"), ...filteredTasks.filter((task) => task.status !== "needs-attention").slice(0, 6)]
    : filteredTasks;
  const settlements = [2025, 2026].includes(document.settings.taxYear) ? calculateSettlements({
    entries: document.incomeEntries, payments: document.taxPayments, taxYear: document.settings.taxYear,
    mode: document.settings.settlementMode, jointSpouseThreshold: document.settings.jointSpouseThreshold,
  }) : [];
  const outstandingTax = settlements.reduce((sum, item) => sum + item.outstandingGrosz, 0);
  const monthIncome = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(selectedMonth))
    .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0);
  const remainingRent = document.properties.reduce((sum, property) => {
    const amounts = rentMonthAmounts(document, property, selectedMonth, now);
    return sum + (amounts.remainingGrosz ?? 0);
  }, 0);
  const sixMonths = Array.from({ length: 6 }, (_, index) => shiftMonth(todayIsoDate().slice(0, 7), index - 5));
  const chart = sixMonths.map((month) => ({ month, total: document.incomeEntries
    .filter((entry) => entry.receivedAt.startsWith(month) && (!chartPropertyId || entry.propertyId === chartPropertyId))
    .reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0) }));
  const maxChart = Math.max(1, ...chart.map((item) => item.total));

  const setState = (taskId: string, change: { snoozedUntil?: string; dismissedAt?: string; completedAt?: string }) => {
    void update((current) => ({ ...current, taskStates: setTaskState(current.taskStates, taskId, change) })).catch(() => undefined);
  };
  const openTask = (task: AssistantTask) => {
    if (task.type === "TENANT_PAYMENT_CHECK") navigation.navigate("Przychód", {
      quickAdd: true, propertyId: task.propertyId, rentalMonth: task.period,
      expectedAmount: task.remainingGrosz ? (task.remainingGrosz / 100).toFixed(2) : undefined,
    });
    else if (task.type === "TAX_PAYMENT") navigation.navigate("Podatek", { period: task.period });
    else if (task.type === "RECURRING_BILL") navigation.navigate("Ustawienia", { billId: task.id.split(":")[1] });
    else if (task.type === "RENTAL_AGREEMENT_END") navigation.navigate("Ustawienia", { propertyId: task.propertyId });
    else {
      setCustomTaskId(task.id);
      setCustomTaskDone(task.status === "completed");
      const reminder = document.customReminders.find((item) => `CUSTOM_REMINDER:${item.id}` === task.id);
      setCustomTitle(reminder?.title ?? task.title);
      setCustomDate(reminder?.dueDate ?? localIso(task.dueAt));
      setCustomNote(reminder?.note ?? "");
      setCustomPropertyId(reminder?.propertyId ?? "");
      setCustomOpen(true);
    }
  };
  const addIncome = () => navigation.navigate("Przychód", { quickAdd: true });
  const openTax = () => {
    const next = tasks.find((task) => task.type === "TAX_PAYMENT" && task.remainingGrosz);
    navigation.navigate("Podatek", next?.period ? { period: next.period } : undefined);
  };
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
    setCustomPropertyId(""); setCustomOpen(true);
  };
  const saveCustom = async () => {
    if (!customTitle.trim() || !isValidCalendarDate(customDate)) {
      Alert.alert("Sprawdź przypomnienie", "Wpisz tytuł i prawidłową datę RRRR-MM-DD."); return;
    }
    const item: CustomReminder = { id: customTaskId ? customTaskId.replace("CUSTOM_REMINDER:", "") : createId("reminder"), title: customTitle.trim(), dueDate: customDate,
      ...(customPropertyId ? { propertyId: customPropertyId } : {}), ...(customNote.trim() ? { note: customNote.trim() } : {}) };
    try {
      await update((current) => ({ ...current,
        customReminders: customTaskId ? current.customReminders.map((reminder) => reminder.id === item.id ? item : reminder) : [...current.customReminders, item],
        taskStates: customTaskId ? current.taskStates.filter((state) => state.taskId !== customTaskId) : current.taskStates,
      }));
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
  const shiftSelectedMonth = (offset: number) => setSelectedMonth((month) => shiftMonth(month, offset));

  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View><Text style={pageTitle}>Pulpit</Text><Text style={muted}>Dzień dobry</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dodaj osobiste przypomnienie" onPress={openCustom} style={iconButton}><Text style={action}>＋</Text></Pressable>
      </View>

      <View style={sectionHeader}><Text style={sectionTitle}>Do zrobienia</Text><Text style={muted}>Do sprawdzenia · {attention.length}</Text></View>
      <View style={segmented}>{([["active", "Aktywne"], ["completed", "Zakończone"], ["dismissed", "Ukryte"]] as const).map(([key, label]) =>
        <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: view === key }} onPress={() => setView(key)} style={[segment, view === key && selectedSegment]}><Text style={view === key ? selectedSegmentText : segmentText}>{label}</Text></Pressable>)}</View>
      {shownTasks.length ? shownTasks.map((task) => <TaskRow key={task.id} task={task} onOpen={() => openTask(task)} onSnooze={() => { setSnoozeDate(localIso(snoozeOptions(now)[0]!.until)); setSnoozeTask(task); }} onDismiss={() => setState(task.id, { dismissedAt: new Date().toISOString(), snoozedUntil: undefined })} onComplete={() => manualComplete(task)} />)
        : <Text style={emptyText}>{view === "active" ? "Wszystko na dziś załatwione." : view === "completed" ? "Brak zakończonych spraw." : "Brak ukrytych spraw."}</Text>}
      {view === "active" && tasks.some((task) => task.status === "upcoming" || task.status === "snoozed") ? <Text style={muted}>Nadchodzące sprawy pozostają na liście; uśpione wrócą w wybranym terminie.</Text> : null}

      <Text style={sectionTitle}>Szybkie akcje</Text>
      <View style={quickRow}>
        <QuickAction label="Dodaj wpłatę" onPress={addIncome} />
        <QuickAction label="Podatek" onPress={openTax} />
        <QuickAction label="Administracja" onPress={() => openAdministration()} />
      </View>
      <View style={linkRow}>
        <Text style={smallLabel}>Usługi podatkowe MF</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://www.podatki.gov.pl/mikrorachunek-podatkowy/")}><Text style={action}>Mikrorachunek</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("https://www.podatki.gov.pl/e-urzad-skarbowy/")}><Text style={action}>e-Urząd Skarbowy</Text></Pressable>
      </View>

      <View style={sectionHeader}>
        <Text style={sectionTitle}>Przegląd miesiąca</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc" onPress={() => shiftSelectedMonth(-1)}><Text style={action}>‹</Text></Pressable>
          <Text style={smallLabel}>{monthLabel(selectedMonth)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Następny miesiąc" onPress={() => shiftSelectedMonth(1)}><Text style={action}>›</Text></Pressable>
        </View>
      </View>
      <View style={kpiGrid}>
        <Kpi label="Otrzymano" value={formatPln(monthIncome)} />
        <Kpi label="Do potwierdzenia" value={formatPln(remainingRent)} />
        <Kpi label="Podatek do zapłaty" value={formatPln(outstandingTax)} />
        <Kpi label="Sprawy do sprawdzenia" value={String(attention.length)} />
      </View>
      <Text style={smallLabel}>Wpływy z ostatnich 6 miesięcy</Text>
      <View style={chartFilter}>{[{ id: null, name: "Wszystkie" }, ...document.properties.map((property) => ({ id: property.id, name: property.name }))].map((item) =>
        <Pressable key={item.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: chartPropertyId === item.id }} onPress={() => setChartPropertyId(item.id)} style={[filterButton, chartPropertyId === item.id && selectedFilter]}><Text style={filterText}>{item.name}</Text></Pressable>)}</View>
      <View accessibilityLabel="Wykres potwierdzonych wpływów z sześciu miesięcy" style={chartContainer}>
        {chart.map((item) => <View key={item.month} style={barColumn}>
          <Text style={barValue}>{item.total ? formatPln(item.total).replace(" zł", "") : "–"}</Text>
          <View style={barTrack}><View style={[barFill, { height: `${item.total ? Math.max(4, item.total / maxChart * 100) : 0}%` }]} /></View>
          <Text style={barMonth}>{item.month.slice(5)}</Text>
        </View>)}
      </View>

      <View style={sectionHeader}><Text style={sectionTitle}>Mieszkania</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia")}><Text style={action}>Ustawienia ›</Text></Pressable></View>
      {!document.properties.length ? <View style={emptyRow}><Text style={emptyText}>Dodaj mieszkanie, aby zobaczyć czynsz i terminy.</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia")}><Text style={action}>Dodaj mieszkanie</Text></Pressable></View> : document.properties.map((property) => {
        const amount = rentMonthAmounts(document, property, selectedMonth, now);
        const nextTask = tasks.filter((task) => task.propertyId === property.id && task.status !== "completed" && task.status !== "dismissed").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
        const links = document.propertyLinks.filter((link) => link.propertyId === property.id);
        return <View key={property.id} style={propertyRow}>
          <View style={propertyHeader}><View style={{ flex: 1 }}><Text style={propertyName}>{property.name}</Text>{property.tenantName ? <Text style={muted}>{property.tenantName}</Text> : null}</View>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { propertyId: property.id })}><Text style={action}>Edytuj</Text></Pressable></View>
          {amount.expectedGrosz === null ? <Text style={muted}>Oczekiwany czynsz za {selectedMonth} nieustalony</Text> : <>
            <OverviewMetric label="Oczekiwano" amount={amount.expectedGrosz} />
            <OverviewMetric label="Otrzymano" amount={amount.confirmedGrosz} />
            <OverviewMetric label="Do potwierdzenia" amount={amount.remainingGrosz ?? 0} />
          </>}
          {property.rentalEndDate ? <Text style={muted}>Koniec umowy · {property.rentalEndDate}</Text> : null}
          {nextTask ? <Text style={muted}>Następna sprawa · {nextTask.title}</Text> : null}
          <View style={quickRow}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Przychód", { quickAdd: true, propertyId: property.id, rentalMonth: selectedMonth, expectedAmount: amount.remainingGrosz ? (amount.remainingGrosz / 100).toFixed(2) : undefined })}><Text style={action}>Dodaj wpłatę</Text></Pressable>
            {property.administratorPortalUrl ? <Pressable accessibilityRole="link" onPress={() => openAdministration(property)}><Text style={action}>Otwórz panel administracji</Text></Pressable> : null}
            {links.map((link) => <Pressable key={link.id} accessibilityRole="link" onPress={() => void Linking.openURL(link.url)}><Text style={action}>{link.label}</Text></Pressable>)}
          </View>
        </View>;
      })}
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
          <Text style={smallLabel}>Mieszkanie (opcjonalnie)</Text><View style={chartFilter}>{document.properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: customPropertyId === property.id }} onPress={() => setCustomPropertyId(customPropertyId === property.id ? "" : property.id)} style={[filterButton, customPropertyId === property.id && selectedFilter]}><Text style={filterText}>{property.name}</Text></Pressable>)}</View>
          <Text style={smallLabel}>Notatka (opcjonalnie)</Text><TextInput accessibilityLabel="Notatka przypomnienia" value={customNote} onChangeText={setCustomNote} multiline style={[input, { minHeight: 88, textAlignVertical: "top" }]} />
          {customTaskId ? <><Pressable accessibilityRole="button" onPress={() => void saveCustom()} style={secondaryButton}><Text style={buttonText}>Zapisz zmiany</Text></Pressable>
            {!customTaskDone ? <Pressable accessibilityRole="button" onPress={() => { setState(customTaskId, { completedAt: new Date().toISOString() }); setCustomOpen(false); }} style={secondaryButton}><Text style={buttonText}>Oznacz jako załatwione</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => Alert.alert("Usunąć przypomnienie?", customTitle, [{ text: "Anuluj", style: "cancel" }, { text: "Usuń", style: "destructive", onPress: () => { const id = customTaskId.replace("CUSTOM_REMINDER:", ""); void update((current) => ({ ...current, customReminders: current.customReminders.filter((item) => item.id !== id), taskStates: current.taskStates.filter((item) => item.taskId !== customTaskId) })).catch(() => undefined); setCustomOpen(false); } }])} style={destructiveButton}><Text style={dangerText}>Usuń przypomnienie</Text></Pressable></>
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

function TaskRow({ task, onOpen, onSnooze, onDismiss, onComplete }: { task: AssistantTask; onOpen: () => void; onSnooze: () => void; onDismiss: () => void; onComplete: () => void }) {
  const stateColor = task.status === "needs-attention" ? theme.colors.warning : task.status === "snoozed" ? theme.colors.info : task.status === "completed" ? theme.colors.success : theme.colors.textSecondary;
  const statusLabel: Record<TaskStatus, string> = { upcoming: "Nadchodzące", "needs-attention": "Do sprawdzenia", snoozed: "Uśpione", completed: "Zakończone", dismissed: "Ukryte" };
  return <View style={taskCard}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <View style={{ flex: 1 }}><Text style={taskTitle}>{task.title}</Text><Text style={muted}>{task.detail || taskTypeLabel[task.type]}</Text></View>
      <Text style={[statusText, { color: stateColor }]}>{statusLabel[task.status]}</Text>
    </View>
    <Text style={taskMeta}>{taskTypeLabel[task.type]} · termin {task.dueAt.toLocaleDateString("pl-PL")}</Text>
    <View style={taskActions}>
      {task.status !== "dismissed" && task.status !== "completed" ? <>
        <Pressable accessibilityRole="button" onPress={onOpen}><Text style={action}>{task.type === "CUSTOM_REMINDER" ? "Szczegóły" : task.type === "RENTAL_AGREEMENT_END" ? "Zmień datę zakończenia" : "Otwórz"}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onSnooze}><Text style={action}>Przypomnij później</Text></Pressable>
        {task.manuallyCompletable ? <Pressable accessibilityRole="button" onPress={onComplete}><Text style={action}>Oznacz jako załatwione</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={onDismiss}><Text style={muted}>Ukryj</Text></Pressable>
      </> : task.status === "completed" ? <Text style={muted}>{task.type === "RECURRING_BILL" ? "Ręcznie potwierdzona płatność" : "Wynika z zapisanych danych"}</Text> : null}
    </View>
  </View>;
}

function OverviewMetric({ label, amount }: { label: string; amount: number }) { return <View style={metricRow}><Text style={muted}>{label}</Text><Text style={metricValue}>{formatPln(amount)}</Text></View>; }
function Kpi({ label, value }: { label: string; value: string }) { return <View style={kpi}><Text style={kpiLabel}>{label}</Text><Text style={kpiValue}>{value}</Text></View>; }
function QuickAction({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={quickButton}><Text style={quickText}>{label}</Text></Pressable>; }
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={modalHeader}><Text style={modalTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={action}>Zamknij</Text></Pressable></View>; }
function shiftMonth(month: string, offset: number) { const [year, number] = month.split("-").map(Number); const date = new Date(year!, number! - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(month: string) { const [year, number] = month.split("-").map(Number); return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(year!, number! - 1, 1)); }

const pageTitle = { color: theme.colors.textPrimary, fontSize: 25, fontWeight: "700" as const };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" as const, marginTop: 22, marginBottom: 8 };
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const smallLabel = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" as const };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };
const sectionHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 12 };
const segmented = { flexDirection: "row" as const, padding: 3, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 8, gap: 3, marginBottom: 8 };
const segment = { flex: 1, minHeight: 34, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 6 };
const selectedSegment = { backgroundColor: theme.colors.surface };
const segmentText = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const };
const selectedSegmentText = { color: theme.colors.textPrimary, fontSize: 12, fontWeight: "700" as const };
const taskCard = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, padding: 12, marginVertical: 4 };
const taskTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 15 };
const statusText = { fontSize: 11, fontWeight: "700" as const };
const taskMeta = { color: theme.colors.textMuted, fontSize: 11, marginTop: 7 };
const taskActions = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 14, marginTop: 9 };
const emptyText = { color: theme.colors.textSecondary, backgroundColor: theme.colors.surfaceSecondary, padding: 12, borderRadius: 8, marginVertical: 4, fontSize: 13 };
const quickRow = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginVertical: 8 };
const quickButton = { flexGrow: 1, minWidth: 96, minHeight: 42, backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderWidth: 1, borderRadius: 8, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 9 };
const quickText = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "700" as const, textAlign: "center" as const };
const linkRow = { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const kpiGrid = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginVertical: 9 };
const kpi = { width: "48%" as const, minHeight: 66, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 8, padding: 10, justifyContent: "space-between" as const };
const kpiLabel = { color: theme.colors.textSecondary, fontSize: 11 };
const kpiValue = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const, marginTop: 6 };
const chartFilter = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginVertical: 8 };
const filterButton = { borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 };
const selectedFilter = { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.primary };
const filterText = { color: theme.colors.textPrimary, fontSize: 11 };
const chartContainer = { height: 145, borderBottomWidth: 1, borderColor: theme.colors.divider, flexDirection: "row" as const, alignItems: "stretch" as const, justifyContent: "space-around" as const, marginBottom: 10 };
const barColumn = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const, paddingHorizontal: 2 };
const barValue = { color: theme.colors.textMuted, fontSize: 9, height: 18, textAlign: "center" as const };
const barTrack = { height: 98, width: "55%" as const, backgroundColor: theme.colors.surfaceSecondary, justifyContent: "flex-end" as const, borderRadius: 3, overflow: "hidden" as const };
const barFill = { width: "100%" as const, backgroundColor: theme.colors.primary, minHeight: 0 };
const barMonth = { color: theme.colors.textSecondary, fontSize: 10, marginVertical: 6 };
const propertyRow = { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const propertyHeader = { flexDirection: "row" as const, alignItems: "flex-start" as const, justifyContent: "space-between" as const, gap: 12, marginBottom: 4 };
const propertyName = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const };
const metricRow = { flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 2 };
const metricValue = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" as const };
const emptyRow = { gap: 7, marginTop: 4 };
const iconButton = { width: 38, height: 38, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 8, backgroundColor: theme.colors.accentSoft };
const modalBackdrop = { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center" as const, padding: 18 };
const modalPanel = { backgroundColor: theme.colors.modalBackground, borderRadius: 8, padding: 18, maxHeight: "85%" as const };
const modalHeader = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const modalTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 18 };
const modalAction = { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const input = { borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, borderRadius: 8, minHeight: 44, paddingHorizontal: 11, marginTop: 6, marginBottom: 12 };
const primaryButton = { minHeight: 46, justifyContent: "center" as const, alignItems: "center" as const, backgroundColor: theme.colors.primary, borderRadius: 8, marginTop: 10 };
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const };
const secondaryButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, marginTop: 9 };
const buttonText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const destructiveButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 8, marginTop: 9 };
const dangerText = { color: theme.colors.danger, fontWeight: "600" as const };
