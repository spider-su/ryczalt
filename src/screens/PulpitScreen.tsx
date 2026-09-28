import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { deriveTasks, localIso, rentMonthAmounts, setTaskState, snoozeOptions, type AssistantTask } from "../domain/tasks";
import { calculateTaxYear, formatPln, hasTaxRulesForYear, moneyToGrosz, settlementPeriodForMonth } from "../domain/ryczaltTax";
import { taxSummaryForPeriod } from "../domain/taxPresentation";
import { isValidCalendarDate } from "../domain/rentalValidation";
import { deriveSetupProgress, type SetupAction } from "../domain/setupProgress";
import { setupActionIntent } from "../navigation/setupIntent";
import { recurringBillTaskIntent } from "../navigation/billIntent";
import { navigateToTaxDetails } from "../navigation/taxIntent";
import type { CustomReminder, Property, ReminderRecurrence } from "../model/rental";
import { deleteCustomReminder, findCustomReminderForTask, recurrenceLabel, saveCustomReminder } from "../domain/customReminders";
import { useReminders } from "../notifications/ReminderProvider";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { TaskRow } from "../components/pulpit/TaskRow";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import { dashboardAttentionTasks, dashboardProgress, daysOverdue, rentCheckAgeLabel, rentDisplayState, rentStatusLabel, unallocatedRentWarning } from "../domain/rentalPresentation";
import { bulkRentItems, bulkSelectionTotal, defaultBulkSelection, makeBulkRentEntries, toggleBulkSelection } from "../domain/bulkRentConfirmation";
import { formatPolishCount, formatPolishDate, formatPolishMonth, formatPlnSummary } from "../domain/presentationFormat";
import { ProgressBar } from "../components/ProgressBar";
import { PeriodSelector } from "../components/PeriodSelector";
import { StatusBadge } from "../components/StatusBadge";
import { currentRentalMonth, earliestDashboardMonth, shiftDashboardMonth } from "../domain/dashboardPeriods";

export function PulpitScreen() {
  const { document, update, enterDemoMode } = useRentalData();
  const { permission } = useReminders();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [selectedMonth, setSelectedMonth] = useState(() => todayIsoDate().slice(0, 7));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkReceivedAt, setBulkReceivedAt] = useState(todayIsoDate());
  const [bulkSaving, setBulkSaving] = useState(false);
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
  const currentMonth = currentRentalMonth(now);
  const earliestMonth = earliestDashboardMonth(document.properties.filter((property) => (property.lifecycle ?? "ACTIVE") === "ACTIVE"), document.incomeEntries, now);
  const attention = dashboardAttentionTasks(tasks);
  const taxIssues = attention.filter((task) => task.type === "TAX_PAYMENT");
  const otherAttention = attention.filter((task) => task.type !== "TAX_PAYMENT");
  const selectedYear = Number(selectedMonth.slice(0, 4));
  const openingRevenue = selectedYear === document.settings.taxYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0;
  const openingTaxPaid = selectedYear === document.settings.taxYear && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0;
  const taxCalculation = hasTaxRulesForYear(selectedYear) ? calculateTaxYear({
    entries: document.incomeEntries, payments: document.taxPayments, taxYear: selectedYear,
    mode: document.settings.settlementMode, jointSpouseThreshold: document.settings.jointSpouseThreshold,
    openingTaxableRevenueGrosz: openingRevenue, openingTaxPaidGrosz: openingTaxPaid,
  }) : undefined;
  const settlements = taxCalculation?.settlements ?? [];
  const activeProperties = document.properties.filter((property) => (property.lifecycle ?? "ACTIVE") === "ACTIVE"
    && (!property.rentalStartDate || property.rentalStartDate.slice(0, 7) <= selectedMonth));
  const monthAmounts = activeProperties.map((property) => rentMonthAmounts(property, document.incomeEntries, selectedMonth, now, monthDistance(selectedMonth, now)));
  const rentExpectationKnown = monthAmounts.every((amount) => amount.expectedGrosz !== null);
  const expectedRent = monthAmounts.reduce((sum, amount) => sum + (amount.expectedGrosz ?? 0), 0);
  const remainingRent = monthAmounts.reduce((sum, amount) => {
    return sum + (amount.remainingGrosz ?? 0);
  }, 0);
  const receivedRent = expectedRent - remainingRent;
  const rentProgress = dashboardProgress(receivedRent, expectedRent);
  const currentPeriodKey = settlementPeriodForMonth(selectedMonth, document.settings.settlementMode);
  const taxSummary = currentPeriodKey ? taxSummaryForPeriod(settlements, currentPeriodKey) : { current: null, previousOutstanding: { count: 0, totalGrosz: 0 } };
  const currentPeriod = taxSummary.current;
  const projectedOlderPeriods = new Set(settlements.filter((item) => currentPeriodKey && item.period < currentPeriodKey && item.outstandingGrosz > 0).map((item) => item.period));
  const taxAttentionTasks = taxIssues.filter((task) => task.period !== currentPeriodKey && !projectedOlderPeriods.has(task.period ?? ""));
  const hasOlderTaxIssue = taxSummary.previousOutstanding.count > 0 || (taxCalculation?.openingBalance.outstandingGrosz ?? 0) > 0;
  const pendingRents = bulkRentItems(activeProperties, document.incomeEntries, selectedMonth, now);
  const selectedRentTotal = bulkSelectionTotal(pendingRents, bulkSelectedIds);

  const setState = (taskId: string, change: { snoozedUntil?: string; dismissedAt?: string; completedAt?: string }) => {
    void update((current) => ({ ...current, taskStates: setTaskState(current.taskStates, taskId, change) })).catch(() => undefined);
  };
  const openTask = (task: AssistantTask) => {
    if (task.type === "TENANT_PAYMENT_CHECK") navigation.navigate("Przychód", {
      quickAdd: true, propertyId: task.propertyId, rentalMonth: task.period,
      expectedAmount: task.remainingGrosz ? (task.remainingGrosz / 100).toFixed(2) : undefined,
    });
    else if (task.type === "TAX_PAYMENT") navigateToTaxDetails(navigation, task.period);
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
  const addIncome = (propertyId?: string, rentalMonth?: string) => navigation.navigate("Przychód", { quickAdd: true, ...(propertyId ? { propertyId } : {}), ...(rentalMonth ? { rentalMonth } : {}) });
  const openAdministration = (property?: Property) => {
    const linked = document.properties.filter((item) => item.administrationUrl);
    if (property) {
      const url = property.administrationUrl;
      if (url) void Linking.openURL(url).catch(() => Alert.alert("Nie można otworzyć portalu", "Sprawdź zapisany adres HTTPS."));
      else navigation.navigate("Ustawienia", { propertyId: property.id });
      return;
    }
    if (linked.length === 1) { openAdministration(linked[0]); return; }
    if (linked.length > 1) setAdminPickerVisible(true);
    else navigation.navigate("Ustawienia");
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
  const openBulkConfirmation = () => {
    setBulkSelectedIds(defaultBulkSelection(pendingRents));
    setBulkReceivedAt(todayIsoDate());
    setBulkOpen(true);
  };
  const confirmBulkRent = async () => {
    if (bulkSaving || bulkSelectedIds.length === 0) return;
    if (bulkSelectedIds.some((id) => !document.properties.find((property) => property.id === id)?.taxableTreatment)) {
      Alert.alert("Ustaw sposób opodatkowania", "Wybierz sposób wliczania opłat w ustawieniach każdego mieszkania przed potwierdzeniem wpłat.");
      return;
    }
    if (!isValidCalendarDate(bulkReceivedAt) || bulkReceivedAt > todayIsoDate()) {
      Alert.alert("Sprawdź datę wpłaty", "Wpisz prawidłową datę nie późniejszą niż dzisiaj.");
      return;
    }
    setBulkSaving(true);
    try {
      await update((current) => {
        const entries = makeBulkRentEntries({ properties: current.properties, priorEntries: current.incomeEntries,
          selectedPropertyIds: bulkSelectedIds, rentalMonth: selectedMonth, receivedAt: bulkReceivedAt, now,
          createId: () => createId("income") });
        if (entries.length !== bulkSelectedIds.length) throw new Error("Selected rent changed before save.");
        return { ...current, incomeEntries: [...current.incomeEntries, ...entries] };
      });
      setBulkOpen(false);
    } catch {
      Alert.alert("Wpłaty nie zostały potwierdzone", "Nie udało się zapisać zestawu wpłat. Żadna nie została oznaczona jako potwierdzona — sprawdź dane i spróbuj ponownie.");
    } finally { setBulkSaving(false); }
  };

  if (activeProperties.length === 0) return <View style={ui.page}>
    <ScrollView contentContainerStyle={ui.content}>
      <View accessibilityLabel="Skonfiguruj pierwszy najem" style={setupCard}>
        <Text style={setupTitle}>Skonfiguruj pierwszy najem</Text>
        <Text style={muted}>Dodaj mieszkanie, aby zapisać oczekiwany czynsz i terminy. Wpłaty ani płatności nie zostaną utworzone automatycznie.</Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { setupAction: "apartment" })} style={primaryButton}><Text style={primaryText}>Otwórz ustawienia mieszkań</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={enterDemoMode} style={demoButton}><Text style={action}>Zobacz demo</Text></Pressable>
      </View>
      {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne tutaj.</Text> : null}
    </ScrollView>
  </View>;

  return <View style={ui.page}>
    <ScrollView contentContainerStyle={ui.content}>
      <PeriodSelector value={monthLabel(selectedMonth)} valueLabel={monthLabel(selectedMonth)} previousLabel="Poprzedni miesiąc" nextLabel="Następny miesiąc"
        previousDisabled={selectedMonth <= earliestMonth} nextDisabled={selectedMonth >= currentMonth}
        onPrevious={() => setSelectedMonth((month) => shiftDashboardMonth(month, -1, now, earliestMonth))}
        onNext={() => setSelectedMonth((month) => shiftDashboardMonth(month, 1, now, earliestMonth))} />
      <View style={[ui.card, summaryCard]}>
        {!rentExpectationKnown ? <>
          <Text style={summaryMainLine}>Czynsz: <Text style={summaryMainValue}>—</Text></Text>
          <Text style={muted}>Uzupełnij oczekiwany czynsz</Text>
        </> : <>
          <Text style={summaryMainLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>Czynsz: <Text style={summaryMainValue}>{compactPln(receivedRent)}</Text></Text>
          {expectedRent > 0 && receivedRent < expectedRent
            ? <Pressable accessibilityRole="button" accessibilityLabel={`${formatPln(remainingRent)} do potwierdzenia. Potwierdź wpłaty`} onPress={openBulkConfirmation}><Text style={muted}>{compactPln(remainingRent)} do potwierdzenia</Text></Pressable>
            : <Text style={muted}>{expectedRent === 0 ? "Brak oczekiwanego czynszu" : "Wpłaty potwierdzone"}</Text>}
          <ProgressBar fraction={rentProgress.fraction} accessibilityLabel="Postęp opłaconych czynszów" />
          <Text style={summaryExpected}>z oczekiwanych {compactPln(expectedRent)}</Text>
        </>}
        <Pressable accessibilityRole="button" accessibilityLabel={currentPeriod ? `Podatek ${compactPln(currentPeriod.obligationGrosz)}. ${currentPeriod.status === "paid" ? "Opłacone" : currentPeriod.status === "no-tax" ? "Brak podatku" : `Termin ${formatPolishDate(currentPeriod.dueDate)}`}` : "Podatek"} onPress={() => navigateToTaxDetails(navigation)} style={summaryTax}>
          <Text style={summaryMainLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>Podatek: <Text style={summaryMainValue}>{currentPeriod ? compactPln(currentPeriod.obligationGrosz) : "—"}</Text></Text>
          <Text style={summaryTaxDetail}>{currentPeriod?.status === "no-tax" ? "Brak podatku do zapłaty" : currentPeriod?.status === "paid" ? `Opłacone · Termin płatności: ${formatPolishDate(currentPeriod.dueDate)}` : currentPeriod?.status === "overdue" ? `Pozostało ${compactPln(currentPeriod.outstandingGrosz)} · Termin minął ${formatPolishDate(currentPeriod.dueDate)}` : currentPeriod?.status === "partial" ? `Pozostało ${compactPln(currentPeriod.outstandingGrosz)} · Termin płatności: ${formatPolishDate(currentPeriod.dueDate)}` : currentPeriod ? `Termin płatności: ${formatPolishDate(currentPeriod.dueDate)}` : hasTaxRulesForYear(selectedYear) ? "—" : `Brak zweryfikowanych reguł podatkowych dla ${selectedYear}`}</Text>
        </Pressable>
      </View>

      <View style={sectionHeader}><Text style={sectionTitle}>Mieszkania</Text></View>
      {!activeProperties.length ? <View style={emptyRow}><Text style={emptyText}>{document.properties.length ? "Brak aktywnych mieszkań. Wznów najem w Ustawieniach lub dodaj mieszkanie." : "Dodaj mieszkanie w Ustawieniach, aby zobaczyć czynsz i terminy."}</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { setupAction: "apartment" })}><Text style={action}>Otwórz ustawienia mieszkań</Text></Pressable></View> : activeProperties.map((property) => {
        const amount = rentMonthAmounts(property, document.incomeEntries, selectedMonth, now, monthDistance(selectedMonth, now));
        const paymentState = rentDisplayState(amount.expectedGrosz, amount.confirmedGrosz, amount.remainingGrosz);
        const overdueDays = paymentState.kind !== "paid" && paymentState.kind !== "unknown" && property.paymentDay ? daysOverdue(selectedMonth, property.paymentDay, now) : 0;
        const dueDate = property.paymentDay ? rentDueIso(selectedMonth, property.paymentDay) : undefined;
        const checkDatePassed = Boolean(selectedMonth === todayIsoDate().slice(0, 7) && dueDate && dueDate < todayIsoDate() && paymentState.kind !== "paid");
        return <Pressable key={property.id} accessibilityRole="button" accessibilityLabel={`${property.address}, ${property.tenantName ?? ""}, ${rentStatusLabel(paymentState)}`} onPress={() => addIncome(property.id, selectedMonth)} style={[ui.card, propertyRow]}>
          <View style={compactPropertyHeader}><View style={{ flex: 1 }}><Text style={propertyName} numberOfLines={1}>{property.address}</Text>{property.tenantName ? <Text style={compactTenant} numberOfLines={1}>{property.tenantName}</Text> : null}</View>
            <StatusBadge label={rentStatusLabel(paymentState)} tone={paymentState.kind === "paid" ? "positive" : paymentState.kind === "partial" || paymentState.kind === "unpaid" ? "attention" : "neutral"} />
          </View>
          {paymentState.kind === "unknown" ? <Text style={compactMuted}>Uzupełnij oczekiwany czynsz</Text>
            : <Text style={compactAmount}>{compactPln(paymentState.kind === "paid" ? paymentState.expectedGrosz : paymentState.remainingGrosz)}</Text>}
          {checkDatePassed && rentCheckAgeLabel(overdueDays) ? <Text style={overdueMeta}>{rentCheckAgeLabel(overdueDays)}</Text> : null}
          {amount.unallocatedGrosz > 0 ? <Text style={overpaymentWarning}>{unallocatedRentWarning(amount.unallocatedGrosz)}</Text> : null}
        </Pressable>;
      })}

      {taxAttentionTasks.length || otherAttention.length || hasOlderTaxIssue ? <><View style={sectionHeader}><Text style={sectionTitle}>Wymaga uwagi</Text></View>
        {taxSummary.previousOutstanding.count > 0 ? <View style={[ui.card, propertyRow]}><View style={{ flex: 1 }}><Text style={propertyName}>Podatek</Text><Text style={compactMuted}>{formatPolishCount(taxSummary.previousOutstanding.count, ["wcześniejszy okres", "wcześniejsze okresy", "wcześniejszych okresów"])} · {compactPln(taxSummary.previousOutstanding.totalGrosz)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Zobacz zaległości podatkowe" onPress={() => navigateToTaxDetails(navigation)}><Text style={action}>Zobacz zaległości ›</Text></Pressable></View> : null}
        {taxCalculation && taxCalculation.openingBalance.outstandingGrosz > 0 ? <View style={[ui.card, propertyRow]}><View style={{ flex: 1 }}><Text style={propertyName}>Podatek</Text><Text style={compactMuted}>Saldo sprzed śledzenia · {compactPln(taxCalculation.openingBalance.outstandingGrosz)} · bez okresu</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Zobacz dane podatku" onPress={() => navigateToTaxDetails(navigation)}><Text style={action}>Zobacz ›</Text></Pressable></View> : null}
        {taxAttentionTasks.map((task) => <View key={task.id} style={[ui.card, propertyRow]}><View style={{ flex: 1 }}><Text style={propertyName}>{task.title}</Text><Text style={compactMuted}>{compactPln(task.remainingGrosz ?? 0)} · {task.dueAt < now ? "termin minął" : "termin"} {formatPolishDate(task.dueAt)}</Text></View><Pressable accessibilityRole="button" onPress={() => openTask(task)}><Text style={action}>Otwórz</Text></Pressable></View>)}
        {otherAttention.map((task) => <TaskRow key={task.id} task={task} onOpen={() => openTask(task)} onSnooze={() => { setSnoozeDate(localIso(snoozeOptions(now)[0]!.until)); setSnoozeTask(task); }} onDismiss={() => setState(task.id, { dismissedAt: new Date().toISOString(), snoozedUntil: undefined })} onComplete={() => manualComplete(task)} />)}</> : null}

      {setup?.showGuidance && setup.nextAction ? <SetupCard
        label={setup.nextAction.label}
        propertyName={setup.nextAction.propertyName}
        completed={setup.completedRequiredSteps}
        total={setup.totalRequiredSteps}
        onPress={() => openSetupAction(setup.nextAction!.action, setup.nextAction!.propertyId)}
      /> : null}
      {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne tutaj.</Text> : null}



    </ScrollView>

    <Modal visible={bulkOpen} animationType="slide" onRequestClose={() => !bulkSaving && setBulkOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ModalHeader title="Potwierdź otrzymane czynsze" onClose={() => !bulkSaving && setBulkOpen(false)} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: bulkSelectedIds.length === pendingRents.length }} onPress={() => setBulkSelectedIds(bulkSelectedIds.length === pendingRents.length ? [] : defaultBulkSelection(pendingRents))} style={bulkRow}>
            <Text style={bulkCheck}>{bulkSelectedIds.length === pendingRents.length ? "☑" : "□"}</Text><Text style={[bulkItemName, { flex: 1 }]}>Zaznacz wszystkie</Text><Text style={bulkAmount}>{formatPln(pendingRents.reduce((sum, item) => sum + item.amountGrosz, 0))}</Text>
          </Pressable>
          {pendingRents.map((item) => {
            const checked = bulkSelectedIds.includes(item.propertyId);
            return <Pressable key={item.propertyId} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setBulkSelectedIds((ids) => toggleBulkSelection(ids, item.propertyId))} style={bulkRow}>
              <Text style={bulkCheck}>{checked ? "☑" : "□"}</Text><View style={{ flex: 1 }}><Text style={bulkItemName}>{item.address}</Text>{item.tenantName ? <Text style={compactTenant}>{item.tenantName}</Text> : null}</View><Text style={bulkAmount}>{formatPln(item.amountGrosz)}</Text>
            </Pressable>;
          })}
          <Text style={smallLabel}>Data wpłat (RRRR-MM-DD)</Text>
          <TextInput accessibilityLabel="Data wpłat" value={bulkReceivedAt} onChangeText={setBulkReceivedAt} style={input} returnKeyType="done" />
        </ScrollView>
        <View style={bulkFooter}>
          <Text style={summaryDetail}>{formatPolishCount(bulkSelectedIds.length, ["wpłata", "wpłaty", "wpłat"])} · {formatPln(selectedRentTotal)}</Text>
          <Pressable accessibilityRole="button" disabled={bulkSaving || bulkSelectedIds.length === 0} onPress={() => void confirmBulkRent()} style={[primaryButton, (bulkSaving || bulkSelectedIds.length === 0) && disabledButton]}><Text style={primaryText}>{bulkSaving ? "Zapisywanie…" : `Potwierdź ${formatPolishCount(bulkSelectedIds.length, ["wpłatę", "wpłaty", "wpłat"])}`}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>


    <Modal visible={Boolean(snoozeTask)} transparent animationType="fade" onRequestClose={() => setSnoozeTask(null)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={modalBackdrop}><View style={modalPanel}><ModalHeader title="Przypomnij później" onClose={() => setSnoozeTask(null)} />
        <Text style={muted}>Termin zadania i zobowiązanie pozostają bez zmian.</Text>
        {snoozeOptions(now).map(({ days, until }) => <Pressable key={days} accessibilityRole="button" onPress={() => saveSnooze(until)} style={modalAction}><Text style={action}>{days === 1 ? "Jutro" : days === 3 ? "Za 3 dni" : "Za tydzień"} · {formatPolishDate(until)}</Text></Pressable>)}
        <Text style={smallLabel}>Wybierz własną datę (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Data przypomnienia" value={snoozeDate} onChangeText={setSnoozeDate} style={input} />
        <Pressable accessibilityRole="button" onPress={() => {
          const until = new Date(`${snoozeDate}T09:00:00`);
          if (!isValidCalendarDate(snoozeDate) || until <= new Date()) Alert.alert("Nieprawidłowa data", "Wybierz przyszłą datę przypomnienia.");
          else saveSnooze(until);
        }} style={primaryButton}><Text style={primaryText}>Ustaw przypomnienie</Text></Pressable>
      </View></SafeAreaView>
    </Modal>

    <Modal visible={customOpen} animationType="slide" onRequestClose={() => setCustomOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}><ModalHeader title={customTaskId ? "Przypomnienie" : "Nowe przypomnienie"} onClose={() => setCustomOpen(false)} />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={smallLabel}>Tytuł</Text><TextInput accessibilityLabel="Tytuł przypomnienia" value={customTitle} onChangeText={setCustomTitle} style={input} />
          <Text style={smallLabel}>Termin (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Termin przypomnienia" value={customDate} onChangeText={setCustomDate} style={input} />
          <Text style={smallLabel}>Powtarzanie</Text><View style={chartFilter}>{([
            ["ONCE", "Jednorazowo"], ["MONTHLY", "Co miesiąc"], ["YEARLY", "Co rok"],
          ] as const).map(([value, label]) => { const selected = customRecurrence === value; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setCustomRecurrence(value)} style={[filterButton, selected && selectedFilter]}><Text style={[filterText, selected && { fontWeight: "700" }]}>{label}</Text></Pressable>; })}</View>
          {customRecurrence !== "ONCE" && isValidCalendarDate(customDate) ? <Text style={muted}>{recurrenceLabel(customRecurrence, customDate)}</Text> : null}
          <Text style={smallLabel}>Mieszkanie (opcjonalnie)</Text><View style={chartFilter}>{document.properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: customPropertyId === property.id }} onPress={() => setCustomPropertyId(customPropertyId === property.id ? "" : property.id)} style={[filterButton, customPropertyId === property.id && selectedFilter]}><Text style={filterText}>{property.address}</Text></Pressable>)}</View>
          <Text style={smallLabel}>Notatka (opcjonalnie)</Text><TextInput accessibilityLabel="Notatka przypomnienia" value={customNote} onChangeText={setCustomNote} multiline style={[input, { minHeight: 88, textAlignVertical: "top" }]} />
          {customTaskId ? <><Pressable accessibilityRole="button" onPress={() => void saveCustom()} style={secondaryButton}><Text style={buttonText}>Zapisz zmiany</Text></Pressable>
            {!customTaskDone ? <Pressable accessibilityRole="button" onPress={() => { setState(customTaskId, { completedAt: new Date().toISOString() }); setCustomOpen(false); }} style={secondaryButton}><Text style={buttonText}>Oznacz jako załatwione</Text></Pressable> : null}
            <Pressable accessibilityRole="button" onPress={() => Alert.alert("Usunąć przypomnienie?", customTitle, [{ text: "Anuluj", style: "cancel" }, { text: "Usuń", style: "destructive", onPress: () => { const id = customReminderId; void update((current) => deleteCustomReminder(current, id)).catch(() => undefined); setCustomOpen(false); } }])} style={destructiveButton}><Text style={dangerText}>Usuń przypomnienie</Text></Pressable></>
            : <Pressable accessibilityRole="button" onPress={() => void saveCustom()} style={primaryButton}><Text style={primaryText}>Zapisz przypomnienie</Text></Pressable>}
        </ScrollView>
      </SafeAreaView>
    </Modal>

    <Modal visible={adminPickerVisible} transparent animationType="fade" onRequestClose={() => setAdminPickerVisible(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={modalBackdrop}><View style={modalPanel}><ModalHeader title="Administracja" onClose={() => setAdminPickerVisible(false)} />
        {document.properties.filter((item) => item.administrationUrl).map((property) => <Pressable key={property.id} accessibilityRole="button" onPress={() => { setAdminPickerVisible(false); openAdministration(property); }} style={modalAction}><Text style={action}>{property.address}</Text></Pressable>)}
      </View></SafeAreaView>
    </Modal>
  </View>;
}

function SetupCard({ label, propertyName, completed, total, onPress }: { label: string; propertyName?: string; completed: number; total: number; onPress: () => void }) {
  const context = propertyName ? `${propertyName} — ${label.toLocaleLowerCase("pl-PL")}` : label;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${completed} z ${total} kroków konfiguracji: ${context}`} onPress={onPress} style={setupReminderRow}>
    <Text style={{ color: theme.colors.textSecondary, flex: 1 }}>{context}</Text><Text style={actionStyle}>›</Text>
  </Pressable>;
}
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={modalHeader}><Text style={modalTitle}>{title}</Text><Pressable accessibilityRole="button" onPress={onClose}><Text style={action}>Zamknij</Text></Pressable></View>; }
function monthLabel(month: string) { return formatPolishMonth(month); }
function rentDueIso(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year!, monthNumber!, 0).getDate();
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
function monthDistance(month: string, now: Date) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Math.max(6, (year! - now.getFullYear()) * 12 + monthNumber! - now.getMonth() - 1);
}
function compactPln(amountGrosz: number) { return formatPlnSummary(amountGrosz); }

const setupCard = { ...ui.card, marginTop: 14 };
const setupTitle = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const, marginTop: 5 };
const sectionTitle = ui.sectionTitle;
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const demoButton = { minHeight: 44, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 4 };
const smallLabel = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" as const };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };
const sectionHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 12 };
const emptyText = { color: theme.colors.textSecondary, backgroundColor: theme.colors.surface, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 15, marginVertical: 6, fontSize: 14 };
const summaryCard = { padding: 14, marginVertical: 4 };
const summaryMainLine = { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "500" as const, marginTop: 1 };
const summaryMainValue = { color: theme.colors.textPrimary, fontWeight: "700" as const };
const summaryDetail = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, marginTop: 3 };
const summaryExpected = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 };
const summaryTax = { alignItems: "flex-start" as const, borderTopWidth: 1, borderTopColor: theme.colors.divider, marginTop: 10, paddingTop: 8, width: "100%" as const };
const summaryTaxDetail = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "500" as const, marginTop: 2 };
const chartFilter = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginVertical: 8 };
const filterButton = { borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.surface };
const selectedFilter = { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.selectedBorder };
const filterText = { color: theme.colors.textPrimary, fontSize: 11 };
const propertyRow = { paddingVertical: 10, paddingHorizontal: 13, marginTop: 5, minHeight: 64 };
const compactPropertyHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 };
const propertyName = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const };
const compactTenant = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 };
const compactMuted = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const };
const compactAmount = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const, textAlign: "right" as const, marginTop: 4 };
const overdueMeta = { color: theme.colors.danger, fontSize: 12, textAlign: "right" as const, marginTop: 2 };
const bulkRow = { minHeight: 56, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, paddingVertical: 8 };
const bulkCheck = { color: theme.colors.selectedNavigation, fontSize: 22, width: 28, textAlign: "center" as const };
const bulkItemName = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const bulkAmount = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const bulkFooter = { borderTopWidth: 1, borderTopColor: theme.colors.divider, backgroundColor: theme.colors.background, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 };
const disabledButton = { opacity: 0.5 };
const setupReminderRow = { minHeight: 44, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingHorizontal: 4 };
const actionStyle = { color: theme.colors.primary, fontWeight: "700" as const };
const emptyRow = { gap: 7, marginTop: 4 };
const modalBackdrop = { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center" as const, padding: 18 };
const modalPanel = { backgroundColor: theme.colors.modalBackground, borderRadius: 18, padding: 18, maxHeight: "85%" as const };
const modalHeader = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const modalTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 18 };
const modalAction = { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const input = { borderWidth: 1, borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.textPrimary, borderRadius: 12, minHeight: 46, paddingHorizontal: 11, marginTop: 6, marginBottom: 12 };
const primaryButton = { ...ui.primaryButton, marginTop: 10 };
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const };
const overpaymentWarning = { color: theme.colors.warning, fontSize: 12, fontWeight: "600" as const, marginTop: 8 };
const secondaryButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, marginTop: 9 };
const buttonText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const destructiveButton = { minHeight: 44, justifyContent: "center" as const, alignItems: "center" as const, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 8, marginTop: 9 };
const dangerText = { color: theme.colors.danger, fontWeight: "600" as const };
