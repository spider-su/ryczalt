import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { deriveTasks, localIso, rentMonthAmounts, setTaskState, snoozeOptions, type AssistantTask } from "../domain/tasks";
import { calculateTaxYear, formatPln, hasTaxRulesForYear, moneyToGrosz, settlementPeriodForMonth, taxOnRevenue } from "../domain/ryczaltTax";
import { taxSummaryForPeriod } from "../domain/taxPresentation";
import { isPositiveMoney, isValidCalendarDate } from "../domain/rentalValidation";
import { deriveSetupProgress, type SetupAction } from "../domain/setupProgress";
import { setupActionIntent } from "../navigation/setupIntent";
import { navigateToTaxDetails } from "../navigation/taxIntent";
import type { Property } from "../model/rental";
import { useReminders } from "../notifications/ReminderProvider";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { TaskRow } from "../components/pulpit/TaskRow";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import { dashboardAttentionTasks, dashboardProgress, daysOverdue, rentCheckAgeLabel, rentDisplayState, rentStatusLabel, showAggregateExpectedRent, showDashboardYtdProfit, unallocatedRentWarning } from "../domain/rentalPresentation";
import { bulkRentItems, bulkSelectionTotal, defaultBulkSelection, makeBulkRentEntries, toggleBulkSelection } from "../domain/bulkRentConfirmation";
import { formatPolishCount, formatPolishDate, formatPolishMonth, formatPlnSummary } from "../domain/presentationFormat";
import { ProgressBar } from "../components/ProgressBar";
import { PeriodSelector } from "../components/PeriodSelector";
import { StatusBadge } from "../components/StatusBadge";
import { currentRentalMonth, earliestDashboardMonth, shiftDashboardMonth } from "../domain/dashboardPeriods";
import { lifecycleForMonth } from "../domain/apartmentLifecycle";
import { apartmentTermsForMonth, effectivePaymentDay } from "../domain/apartmentTerms";
import { taxSettlementFromSnapshot } from "../domain/periodSnapshots";
import { ownerCashflowSummary } from "../domain/ownerCashflow";
import { makeBillPayment } from "../domain/billPayment";

export function PulpitScreen() {
  const { width, height } = useWindowDimensions();
  const { document, update, enterDemoMode } = useRentalData();
  const { permission } = useReminders();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [selectedMonth, setSelectedMonth] = useState(() => todayIsoDate().slice(0, 7));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [rentDetailsExpanded, setRentDetailsExpanded] = useState(false);
  const [billListOpen, setBillListOpen] = useState(false);
  const [billToConfirmId, setBillToConfirmId] = useState<string | null>(null);
  const [billAmountDraft, setBillAmountDraft] = useState("");
  const [billSaving, setBillSaving] = useState(false);
  const [billAddOpen, setBillAddOpen] = useState(false);
  const [billNameDraft, setBillNameDraft] = useState("");
  const [billExpectedDraft, setBillExpectedDraft] = useState("");
  const [billDueDayDraft, setBillDueDayDraft] = useState("5");
  const [billPropertyDraft, setBillPropertyDraft] = useState("");
  const [adminPickerVisible, setAdminPickerVisible] = useState(false);
  const [snoozeTask, setSnoozeTask] = useState<AssistantTask | null>(null);
  const [snoozeDate, setSnoozeDate] = useState(todayIsoDate());
  const tasks = useMemo(() => document ? deriveTasks(document) : [], [document]);
  const setup = useMemo(() => document ? deriveSetupProgress(document) : null, [document]);
  useEffect(() => {
    const params = route.params as { billId?: string; period?: string } | undefined;
    if (!document || !params?.billId) return;
    const bill = document.recurringBills.find((item) => item.id === params.billId);
    if (!bill) return;
    if (params.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)) setSelectedMonth(params.period);
    setBillAmountDraft(bill.expectedAmount ?? "");
    setBillToConfirmId(bill.id);
    setBillListOpen(false);
    navigation.setParams({ billId: undefined, period: undefined });
  }, [document, navigation, route.params]);

  if (!document) return <View style={ui.page} />;
  const now = new Date();
  const currentMonth = currentRentalMonth(now);
  const earliestMonth = earliestDashboardMonth(document.properties, document.incomeEntries, now);
  const attention = dashboardAttentionTasks(tasks);
  const taxIssues = attention.filter((task) => task.type === "TAX_PAYMENT");
  const otherAttention = attention.filter((task) => task.type !== "TAX_PAYMENT");
  const selectedYear = Number(selectedMonth.slice(0, 4));
  const openingRevenue = selectedYear === document.settings.taxYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0;
  const openingTaxPaid = selectedYear === document.settings.taxYear && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0;
  const selectedTaxSnapshot = document.taxSettlementSnapshots?.find((snapshot) => snapshot.period === selectedMonth);
  const taxCalculation = !selectedTaxSnapshot && hasTaxRulesForYear(selectedYear) ? calculateTaxYear({
    entries: document.incomeEntries, payments: document.taxPayments, taxYear: selectedYear,
    mode: document.settings.settlementMode, jointSpouseThreshold: document.settings.jointSpouseThreshold,
    openingTaxableRevenueGrosz: openingRevenue, openingTaxPaidGrosz: openingTaxPaid,
  }) : undefined;
  const settlements = selectedTaxSnapshot
    ? document.taxSettlementSnapshots!.filter((snapshot) => snapshot.rulesYear === selectedYear && snapshot.period <= selectedMonth).map((snapshot) => taxSettlementFromSnapshot(snapshot, todayIsoDate()))
    : taxCalculation?.settlements ?? [];
  const activeProperties = document.properties.filter((property) => (document.apartmentPeriods ?? []).some((snapshot) => snapshot.propertyId === property.id && snapshot.month === selectedMonth)
    || (lifecycleForMonth(property, selectedMonth) === "ACTIVE" && (!property.rentalStartDate || property.rentalStartDate.slice(0, 7) <= selectedMonth)));
  const monthAmounts = activeProperties.map((property) => {
    const snapshot = document.apartmentPeriods?.find((item) => item.propertyId === property.id && item.month === selectedMonth);
    if (!snapshot) return rentMonthAmounts(property, document.incomeEntries, selectedMonth, now, monthDistance(selectedMonth, now));
    const expectedGrosz = snapshot.expectedKnown && snapshot.expectedAmount !== undefined ? moneyToGrosz(snapshot.expectedAmount) : null;
    const confirmedGrosz = moneyToGrosz(snapshot.confirmedAmount);
    return { expectedGrosz, confirmedGrosz, remainingGrosz: expectedGrosz === null ? null : Math.max(0, expectedGrosz - confirmedGrosz), unallocatedGrosz: 0 };
  });
  const rentExpectationKnown = monthAmounts.every((amount) => amount.expectedGrosz !== null);
  const expectedRent = monthAmounts.reduce((sum, amount) => sum + (amount.expectedGrosz ?? 0), 0);
  const remainingRent = monthAmounts.reduce((sum, amount) => {
    return sum + (amount.remainingGrosz ?? 0);
  }, 0);
  const receivedRent = expectedRent - remainingRent;
  const rentProgress = dashboardProgress(receivedRent, expectedRent);
  const rentFullyConfirmed = rentExpectationKnown && expectedRent > 0 && remainingRent === 0;
  const currentPeriodKey = settlementPeriodForMonth(selectedMonth, document.settings.settlementMode);
  const taxSummary = currentPeriodKey ? taxSummaryForPeriod(settlements, currentPeriodKey) : { current: null, previousOutstanding: { count: 0, totalGrosz: 0 } };
  const currentPeriod = taxSummary.current;
  const projectedOlderPeriods = new Set(settlements.filter((item) => currentPeriodKey && item.period < currentPeriodKey && item.outstandingGrosz > 0).map((item) => item.period));
  const taxAttentionTasks = taxIssues.filter((task) => task.period !== currentPeriodKey && !projectedOlderPeriods.has(task.period ?? ""));
  const openingTaxOutstanding = hasTaxRulesForYear(selectedYear) ? Math.max(0, taxOnRevenue(openingRevenue, selectedYear, document.settings.jointSpouseThreshold) - openingTaxPaid) : 0;
  const hasOlderTaxIssue = taxSummary.previousOutstanding.count > 0 || (taxCalculation?.openingBalance.outstandingGrosz ?? openingTaxOutstanding) > 0;
  const selectedMonthReceipts = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(selectedMonth));
  const ownerCashflow = currentPeriod && selectedMonthReceipts.length > 0 ? ownerCashflowSummary({
    entries: document.incomeEntries,
    selectedEntries: selectedMonthReceipts,
    properties: document.properties,
    taxGrosz: currentPeriod.obligationGrosz,
  }) : null;
  const ytdEntries = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(`${selectedYear}-`) && entry.receivedAt.slice(0, 7) <= selectedMonth);
  const ytdTaxGrosz = settlements
    .filter((settlement) => settlement.period.startsWith(`${selectedYear}-`) && settlement.period <= selectedMonth)
    .reduce((total, settlement) => total + settlement.obligationGrosz, 0);
  const ytdCashflow = ytdEntries.length > 0 ? ownerCashflowSummary({
    entries: document.incomeEntries,
    selectedEntries: ytdEntries,
    properties: document.properties,
    taxGrosz: ytdTaxGrosz,
  }) : null;
  const pendingRents = bulkRentItems(activeProperties, document.incomeEntries, selectedMonth, now);
  const selectedRentTotal = bulkSelectionTotal(pendingRents, bulkSelectedIds);
  const apartmentChargeTerms = activeProperties.map((property) => apartmentTermsForMonth(property, selectedMonth));
  const apartmentChargesKnown = activeProperties.length > 0 && apartmentChargeTerms.every(Boolean);
  const apartmentMediaTotal = apartmentChargeTerms.reduce((sum, terms) => sum + (terms?.mediaPaidByTenant ? terms.mediaAmountGrosz : 0), 0);
  const dashboardBills = document.recurringBills.filter((bill) => activeProperties.some((property) => property.id === bill.propertyId));
  const pendingBills = dashboardBills.filter((bill) => !document.billPayments.some((payment) => payment.billId === bill.id && payment.period === selectedMonth));
  const knownBillTotal = dashboardBills.reduce((sum, bill) => sum + (bill.expectedAmount ? moneyToGrosz(bill.expectedAmount) : 0), 0);
  const billAmountsComplete = dashboardBills.every((bill) => Boolean(bill.expectedAmount));
  const nextPendingBill = pendingBills.filter((bill) => bill.dueDay).sort((left, right) => left.dueDay! - right.dueDay!)[0];
  const nextPendingDue = nextPendingBill?.dueDay ? rentDueIso(selectedMonth, nextPendingBill.dueDay) : null;
  const dashboardFullyApproved = showDashboardYtdProfit({
    rentFullyConfirmed,
    pendingBillCount: pendingBills.length,
    taxApproved: Boolean(currentPeriod && currentPeriod.outstandingGrosz === 0 && taxSummary.previousOutstanding.count === 0),
    chargesKnown: Boolean(ytdCashflow?.chargesKnown),
  });
  const billToConfirm = document.recurringBills.find((bill) => bill.id === billToConfirmId);

  const setState = (taskId: string, change: { snoozedUntil?: string; dismissedAt?: string; completedAt?: string }) => {
    void update((current) => ({ ...current, taskStates: setTaskState(current.taskStates, taskId, change) })).catch(() => undefined);
  };
  const openTask = (task: AssistantTask) => {
    if (task.type === "TENANT_PAYMENT_CHECK") navigation.navigate("Przychód", {
      quickAdd: true, propertyId: task.propertyId, rentalMonth: task.period,
      expectedAmount: task.remainingGrosz ? (task.remainingGrosz / 100).toFixed(2) : undefined,
    });
    else if (task.type === "TAX_PAYMENT") navigateToTaxDetails(navigation, task.period);
    else if (task.type === "RECURRING_BILL") {
      const bill = document.recurringBills.find((item) => item.id === task.billId);
      if (bill) { setSelectedMonth(task.period ?? selectedMonth); setBillAmountDraft(bill.expectedAmount ?? ""); setBillToConfirmId(bill.id); }
    }
    else navigation.navigate("Ustawienia", { propertyId: task.propertyId });
  };
  const addIncome = (propertyId?: string, rentalMonth?: string) => navigation.navigate("Przychód", { quickAdd: true, returnTo: "Pulpit", ...(propertyId ? { propertyId } : {}), ...(rentalMonth ? { rentalMonth } : {}) });
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
    setBulkOpen(true);
  };
  const confirmBulkRent = async () => {
    if (bulkSaving || bulkSelectedIds.length === 0) return;
    if (bulkSelectedIds.some((id) => !document.properties.find((property) => property.id === id)?.taxableTreatment)) {
      Alert.alert("Ustaw sposób opodatkowania", "Wybierz sposób wliczania opłat w ustawieniach każdego mieszkania przed potwierdzeniem wpłat.");
      return;
    }
    setBulkSaving(true);
    try {
      await update((current) => {
        const entries = makeBulkRentEntries({ properties: current.properties, priorEntries: current.incomeEntries,
          selectedPropertyIds: bulkSelectedIds, rentalMonth: selectedMonth, now: new Date(),
          createId: () => createId("income") });
        if (entries.length !== bulkSelectedIds.length) throw new Error("Selected rent changed before save.");
        return { ...current, incomeEntries: [...current.incomeEntries, ...entries] };
      });
      setBulkOpen(false);
    } catch {
      Alert.alert("Wpłaty nie zostały potwierdzone", "Nie udało się zapisać zestawu wpłat. Żadna nie została oznaczona jako potwierdzona — sprawdź dane i spróbuj ponownie.");
    } finally { setBulkSaving(false); }
  };
  const openBillPayment = (billId: string) => {
    const bill = document.recurringBills.find((item) => item.id === billId);
    if (!bill) return;
    setBillToConfirmId(billId);
    setBillAmountDraft(bill.expectedAmount ?? "");
  };
  const confirmBillPayment = async () => {
    const amount = billAmountDraft.trim().replace(",", ".");
    if (!billToConfirm || !isPositiveMoney(amount) || billSaving) {
      Alert.alert("Sprawdź kwotę", "Wpisz kwotę opłaty większą od 0 zł.");
      return;
    }
    setBillSaving(true);
    try {
      await update((current) => ({ ...current, billPayments: [...current.billPayments, makeBillPayment(createId("bill-payment"), billToConfirm.id, selectedMonth, amount, todayIsoDate())] }));
      setBillToConfirmId(null);
      setBillAmountDraft("");
    } catch {
      Alert.alert("Nie zapisano opłaty", "Nie udało się potwierdzić płatności. Spróbuj ponownie.");
    } finally { setBillSaving(false); }
  };
  const saveRecurringBill = async () => {
    const name = billNameDraft.trim();
    const expectedAmount = billExpectedDraft.trim().replace(",", ".");
    const dueDay = Number(billDueDayDraft);
    if (!billPropertyDraft || !activeProperties.some((property) => property.id === billPropertyDraft) || !name || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || (expectedAmount && !isPositiveMoney(expectedAmount))) {
      Alert.alert("Sprawdź dane opłaty", "Wybierz mieszkanie, wpisz nazwę, prawidłowy dzień miesiąca i opcjonalną kwotę większą od 0 zł.");
      return;
    }
    try {
      await update((current) => ({ ...current, recurringBills: [...current.recurringBills, {
        id: createId("bill"), propertyId: billPropertyDraft, name, dueDay, reminderEnabled: true,
        ...(expectedAmount ? { expectedAmount } : { variableAmount: true }),
      }] }));
      setBillAddOpen(false);
      setBillNameDraft(""); setBillExpectedDraft(""); setBillDueDayDraft("5");
    } catch {
      Alert.alert("Nie zapisano opłaty", "Nie udało się dodać opłaty. Spróbuj ponownie.");
    }
  };

  if (activeProperties.length === 0) {
    const firstApartment = document.properties.length === 0;
    if (firstApartment) return <View style={ui.page}>
      <ScrollView contentContainerStyle={welcomeContent}>
        <View style={[welcomeInner, { minHeight: Math.max(440, height - 180) }]}>
          <View style={welcomeHeading}>
            <Text style={welcomeEyebrow}>RYCZAŁT RENT</Text>
            <Text style={welcomeTitle}>Najem pod kontrolą</Text>
            <Text style={welcomeSubtitle}>Wybierz, jak chcesz zacząć. Możesz skonfigurować mieszkanie lub najpierw spokojnie obejrzeć aplikację.</Text>
          </View>
          <View style={[welcomeChoices, width < 620 && welcomeChoicesNarrow]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Dodaj pierwsze mieszkanie. Trzy krótkie kroki" onPress={() => navigation.navigate("Ustawienia", { setupAction: "apartment", onboarding: true })} style={[welcomeChoice, welcomePrimaryChoice, width < 620 && welcomeChoiceNarrow]}>
              <View style={welcomeIcon}><MaterialIcons name="home" size={30} color={theme.colors.primary} /></View>
              <View style={welcomeCopy}>
                <Text style={welcomeChoiceTitle}>Dodaj mieszkanie</Text>
                <Text style={welcomeChoiceDescription}>Ustaw adres, czynsz i podatek w 3 krótkich krokach.</Text>
              </View>
              <View style={[welcomeAction, welcomePrimaryAction]}><Text style={welcomeActionPrimary}>Rozpocznij konfigurację</Text><MaterialIcons name="arrow-forward" size={19} color={theme.colors.onAccent} /></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zobacz demo aplikacji" onPress={enterDemoMode} style={[welcomeChoice, width < 620 && welcomeChoiceNarrow]}>
              <View style={[welcomeIcon, welcomeDemoIcon]}><MaterialIcons name="visibility" size={29} color={theme.colors.textSecondary} /></View>
              <View style={welcomeCopy}>
                <Text style={welcomeChoiceTitle}>Najpierw zobacz demo</Text>
                <Text style={welcomeChoiceDescription}>Poznaj widoki i funkcje na przykładowych danych.</Text>
              </View>
              <View style={[welcomeAction, welcomeDemoAction]}><Text style={welcomeActionSecondary}>Otwórz wersję demo</Text><MaterialIcons name="arrow-forward" size={19} color={theme.colors.primary} /></View>
            </Pressable>
          </View>
          <View style={privacyNote}>
            <MaterialIcons name="lock-outline" size={18} color={theme.colors.success} />
            <Text style={privacyText}>Twoje dane najmu pozostają na tym urządzeniu i nie są wysyłane na serwer.</Text>
          </View>
        </View>
        {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne tutaj.</Text> : null}
      </ScrollView>
    </View>;

    return <View style={ui.page}><ScrollView contentContainerStyle={ui.content}>
      <View accessibilityLabel="Skonfiguruj najem" style={setupCard}>
        <Text style={setupTitle}>Dodaj aktywne mieszkanie</Text>
        <Text style={muted}>Nie masz teraz aktywnego najmu. Dodaj nowe mieszkanie lub wróć do istniejących ustawień.</Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { setupAction: "apartment" })} style={primaryButton}><Text style={primaryText}>Dodaj mieszkanie</Text></Pressable>
      </View>
      {permission === "denied" ? <Text style={muted}>Powiadomienia systemowe są wyłączone — zadania nadal będą widoczne tutaj.</Text> : null}
    </ScrollView></View>;
  }

  return <View style={ui.page}>
    <ScrollView contentContainerStyle={ui.content}>
      <PeriodSelector value={monthLabel(selectedMonth)} valueLabel={monthLabel(selectedMonth)} previousLabel="Poprzedni miesiąc" nextLabel="Następny miesiąc"
        previousDisabled={selectedMonth <= earliestMonth} nextDisabled={selectedMonth >= currentMonth}
        onPrevious={() => setSelectedMonth((month) => shiftDashboardMonth(month, -1, now, earliestMonth))}
        onNext={() => setSelectedMonth((month) => shiftDashboardMonth(month, 1, now, earliestMonth))} />
      {ownerCashflow ? <View style={[ui.card, summaryCard]}>
        {ownerCashflow.chargesKnown ? <View style={ownerNetBlock}>
          <Text style={summaryEyebrow}>ZYSK</Text>
          <Text style={ownerNetValue}>{compactPln(ownerCashflow.ownerNetGrosz)}</Text>
          {dashboardFullyApproved && ytdCashflow ? <Text style={ownerYtdValue}>{compactPln(ytdCashflow.ownerNetGrosz)} od początku roku</Text> : null}
          <Text style={ownerNetDetail}>po opłatach i podatku</Text>
        </View> : ownerCashflow ? <Text style={ownerNetDetail}>Zysk niedostępny — brakuje warunków najmu dla części wpłat.</Text> : null}
      </View> : null}

      <View style={sectionHeader}><Text style={dashboardSectionTitle}>Mieszkania</Text></View>
      {!activeProperties.length ? <View style={emptyRow}><Text style={emptyText}>{document.properties.length ? "Brak aktywnych mieszkań. Wznów najem w Ustawieniach lub dodaj mieszkanie." : "Dodaj mieszkanie w Ustawieniach, aby zobaczyć czynsz i terminy."}</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate("Ustawienia", { setupAction: "apartment" })}><Text style={action}>Otwórz ustawienia mieszkań</Text></Pressable></View> : <View style={[ui.card, apartmentListCard]}>
        <Pressable accessibilityRole={rentFullyConfirmed ? "button" : undefined}
          accessibilityLabel={rentFullyConfirmed ? `Czynsz ${compactPln(receivedRent)}. Potwierdzone. ${rentDetailsExpanded ? "Ukryj mieszkania" : "Pokaż mieszkania"}` : undefined}
          accessibilityState={rentFullyConfirmed ? { expanded: rentDetailsExpanded } : undefined}
          onPress={rentFullyConfirmed ? () => setRentDetailsExpanded((expanded) => !expanded) : undefined} style={apartmentRentSummary}>
          {!rentExpectationKnown ? <>
            <View style={rentSummaryHeading}><Text style={summaryEyebrow}>CZYNSZ</Text></View>
            <Text style={summaryHeroValue}>—</Text>
            <Text style={muted}>Uzupełnij oczekiwany czynsz</Text>
          </> : <>
            <View style={rentSummaryHeading}><Text style={summaryEyebrow}>CZYNSZ</Text>{rentFullyConfirmed ? <MaterialIcons name={rentDetailsExpanded ? "expand-less" : "expand-more"} size={20} color={theme.colors.textSecondary} /> : null}</View>
            <Text style={summaryHeroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{compactPln(receivedRent)}</Text>
            {rentFullyConfirmed ? <View style={summaryPaidRow}><MaterialIcons name="check-circle" size={15} color={theme.colors.success} /><Text style={summaryPaid}>Potwierdzone</Text></View> : null}
            <ProgressBar fraction={rentProgress.fraction} accessibilityLabel="Postęp potwierdzonych czynszów" />
            {!rentFullyConfirmed && showAggregateExpectedRent(activeProperties.length) ? <Text style={summaryExpected}>z oczekiwanych {compactPln(expectedRent)}</Text> : null}
            {remainingRent > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Potwierdź otrzymane czynsze" onPress={openBulkConfirmation} style={{ alignSelf: "flex-start", paddingVertical: 6 }}><Text style={action}>Potwierdź otrzymane czynsze</Text></Pressable> : null}
          </>}
        </Pressable>
        {(!rentFullyConfirmed || rentDetailsExpanded) && activeProperties.map((property, index) => {
        const amount = rentMonthAmounts(property, document.incomeEntries, selectedMonth, now, monthDistance(selectedMonth, now));
        const paymentState = rentDisplayState(amount.expectedGrosz, amount.remainingGrosz);
        const paymentDay = effectivePaymentDay(property, selectedMonth);
        const overdueDays = paymentState.kind !== "paid" && paymentState.kind !== "unknown" && paymentDay ? daysOverdue(selectedMonth, paymentDay, now) : 0;
        const dueDate = paymentDay ? rentDueIso(selectedMonth, paymentDay) : undefined;
        const checkDatePassed = Boolean(selectedMonth === todayIsoDate().slice(0, 7) && dueDate && dueDate < todayIsoDate() && paymentState.kind !== "paid");
        const rentConfirmed = paymentState.kind === "paid";
        return <Pressable key={property.id} accessibilityRole="button" accessibilityState={{ disabled: rentConfirmed }} accessibilityLabel={`${property.address}, ${property.tenantName ?? ""}, ${rentStatusLabel(paymentState)}${rentConfirmed ? "" : ". Potwierdź czynsz"}`} disabled={rentConfirmed} onPress={() => addIncome(property.id, selectedMonth)} style={[apartmentListRow, index > 0 && apartmentListDivider]}>
          <View style={compactPropertyHeader}><View style={{ flex: 1 }}><Text style={propertyName} numberOfLines={1}>{property.address}</Text>{property.tenantName ? <Text style={compactTenant} numberOfLines={1}>{property.tenantName}</Text> : null}</View>
            {!rentFullyConfirmed ? <StatusBadge label={rentStatusLabel(paymentState)} tone={paymentState.kind === "paid" ? "positive" : paymentState.kind === "unpaid" ? "attention" : "neutral"} /> : null}
          </View>
          {paymentState.kind === "unknown" ? <Text style={compactMuted}>Uzupełnij oczekiwany czynsz</Text>
            : <Text style={compactAmount}>{compactPln(paymentState.kind === "paid" ? paymentState.expectedGrosz : paymentState.remainingGrosz)}</Text>}
          {checkDatePassed && rentCheckAgeLabel(overdueDays) ? <Text style={overdueMeta}>{rentCheckAgeLabel(overdueDays)}</Text> : null}
          {amount.unallocatedGrosz > 0 ? <Text style={overpaymentWarning}>{unallocatedRentWarning(amount.unallocatedGrosz)}</Text> : null}
        </Pressable>;
        })}
      </View>}

      <View style={[paymentActionRow, width < 360 && paymentActionRowStacked]}>
        <Pressable accessibilityRole="button" accessibilityLabel={dashboardBills.length ? `Opłaty. ${pendingBills.length ? `${pendingBills.length} do potwierdzenia` : "potwierdzone"}` : "Dodaj pierwszą opłatę"} onPress={() => setBillListOpen(true)} style={[ui.card, paymentActionCard]}>
          <View style={paymentActionHeading}><MaterialIcons name="receipt-long" size={16} color={theme.colors.textSecondary} /><Text style={summaryEyebrow}>OPŁATY</Text></View>
          <Text style={paymentActionAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{apartmentChargesKnown ? compactPln(apartmentMediaTotal) : dashboardBills.length && billAmountsComplete ? compactPln(knownBillTotal) : dashboardBills.length ? "Kwota zmienna" : "Dodaj"}</Text>
          <Text style={[paymentActionStatus, nextPendingDue && nextPendingDue < todayIsoDate() && paymentActionStatusOverdue]} numberOfLines={2}>{dashboardBills.length === 0 ? "Dodaj rachunki i przypomnienia" : pendingBills.length === 0 ? "✓ Potwierdzone" : `${pendingBills.length} do opłacenia${nextPendingDue ? ` · ${nextPendingDue < todayIsoDate() ? "po terminie" : "termin"} ${formatPolishDate(nextPendingDue)}` : " · ustaw termin"}`}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !currentPeriod || currentPeriod.outstandingGrosz <= 0 }} accessibilityLabel={currentPeriod ? `Podatek ${compactPln(currentPeriod.obligationGrosz)}. ${currentPeriod.status === "paid" ? "Potwierdzone" : currentPeriod.status === "no-tax" ? "Brak podatku" : `Termin ${formatPolishDate(currentPeriod.dueDate)}`}` : "Podatek"} disabled={!currentPeriod || currentPeriod.outstandingGrosz <= 0} onPress={() => currentPeriod && navigation.navigate("Podatek", { period: currentPeriod.period, openPaymentConfirmation: true, returnTo: "Pulpit" })} style={[ui.card, paymentActionCard]}>
          <View style={paymentActionHeading}><MaterialIcons name="account-balance" size={16} color={theme.colors.textSecondary} /><Text style={summaryEyebrow}>PODATEK</Text></View>
          <Text style={paymentActionAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{currentPeriod ? compactPln(currentPeriod.obligationGrosz) : "—"}</Text>
          <Text style={[paymentActionStatus, currentPeriod?.status === "paid" && paymentActionStatusPaid]} numberOfLines={2}>{currentPeriod?.status === "paid" ? "✓ Potwierdzone" : currentPeriod?.status === "no-tax" ? "Brak do zapłaty" : currentPeriod?.status === "overdue" ? `Termin minął · ${formatPolishDate(currentPeriod.dueDate)}` : currentPeriod ? `Termin ${formatPolishDate(currentPeriod.dueDate)}` : `Brak danych dla ${selectedYear}`}</Text>
        </Pressable>
      </View>

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
        <ScrollView contentContainerStyle={bulkListContent} keyboardShouldPersistTaps="handled">
          <Text style={bulkHint}>Zaznacz mieszkania, za które otrzymano pełny czynsz.</Text>
          {pendingRents.length > 1 ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: bulkSelectedIds.length === pendingRents.length }} onPress={() => setBulkSelectedIds(bulkSelectedIds.length === pendingRents.length ? [] : defaultBulkSelection(pendingRents))} style={bulkSelectAllRow}>
            <MaterialIcons name={bulkSelectedIds.length === pendingRents.length ? "check-box" : "check-box-outline-blank"} size={23} color={bulkSelectedIds.length === pendingRents.length ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={bulkSelectAllLabel}>Zaznacz wszystkie</Text><Text style={bulkSelectAllAmount}>{formatPln(pendingRents.reduce((sum, item) => sum + item.amountGrosz, 0))}</Text>
          </Pressable> : null}
          {pendingRents.map((item) => {
            const checked = bulkSelectedIds.includes(item.propertyId);
            return <Pressable key={item.propertyId} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setBulkSelectedIds((ids) => toggleBulkSelection(ids, item.propertyId))} style={[bulkApartmentRow, checked && bulkApartmentRowSelected]}>
              <MaterialIcons name={checked ? "check-box" : "check-box-outline-blank"} size={23} color={checked ? theme.colors.primary : theme.colors.textMuted} />
              <View style={bulkApartmentDetails}><Text style={bulkItemName} numberOfLines={1}>{item.address}</Text>{item.tenantName ? <Text style={compactTenant} numberOfLines={1}>{item.tenantName}</Text> : null}</View>
              <Text style={bulkAmount}>{formatPln(item.amountGrosz)}</Text>
            </Pressable>;
          })}
        </ScrollView>
        <View style={bulkFooter}>
          <Text style={summaryDetail}>{formatPolishCount(bulkSelectedIds.length, ["wpłata", "wpłaty", "wpłat"])} · {formatPln(selectedRentTotal)}</Text>
          <Pressable accessibilityRole="button" disabled={bulkSaving || bulkSelectedIds.length === 0} onPress={() => void confirmBulkRent()} style={[primaryButton, (bulkSaving || bulkSelectedIds.length === 0) && disabledButton]}><Text style={primaryText}>{bulkSaving ? "Zapisywanie…" : `Potwierdź ${formatPolishCount(bulkSelectedIds.length, ["wpłatę", "wpłaty", "wpłat"])}`}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>

    <Modal visible={billListOpen} animationType="slide" onRequestClose={() => setBillListOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ModalHeader title={`Opłaty · ${formatPolishMonth(selectedMonth)}`} onClose={() => setBillListOpen(false)} />
        <ScrollView contentContainerStyle={billListContent}>
          {dashboardBills.length === 0 ? <Text style={muted}>Dodaj cykliczną opłatę, aby otrzymywać przypomnienie w terminie.</Text> : dashboardBills.map((bill) => {
            const property = document.properties.find((item) => item.id === bill.propertyId);
            const payment = document.billPayments.find((item) => item.billId === bill.id && item.period === selectedMonth);
            return <View key={bill.id} style={billListRow}>
              <View style={billListDetails}><Text style={bulkItemName}>{bill.name}</Text><Text style={compactTenant}>{property?.address ?? "Mieszkanie"} · {payment ? formatPln(moneyToGrosz(payment.amount)) : bill.expectedAmount ? formatPln(moneyToGrosz(bill.expectedAmount)) : "zmienna kwota"}</Text><Text style={billListStatus}>{payment ? `✓ Potwierdzone · ${formatPolishDate(payment.paidAt)}` : `Termin ${bill.dueDay ?? "—"}. dnia`}</Text></View>
              {payment ? <MaterialIcons name="check-circle" size={22} color={theme.colors.success} /> : <Pressable accessibilityRole="button" onPress={() => { setBillListOpen(false); openBillPayment(bill.id); }} style={billConfirmLink}><Text style={billConfirmLinkText}>Potwierdź</Text></Pressable>}
            </View>;
          })}
          {activeProperties.length ? <Pressable accessibilityRole="button" onPress={() => { setBillPropertyDraft(activeProperties[0]?.id ?? ""); setBillNameDraft(""); setBillExpectedDraft(""); setBillDueDayDraft("5"); setBillAddOpen(true); }} style={[primaryButton, billAddButton]}><Text style={primaryText}>＋ Dodaj opłatę</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>

    <Modal visible={Boolean(billToConfirm)} transparent animationType="fade" onRequestClose={() => !billSaving && setBillToConfirmId(null)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={modalBackdrop}><View style={modalPanel}>
        <ModalHeader title="Potwierdź opłacenie" onClose={() => !billSaving && setBillToConfirmId(null)} />
        {billToConfirm ? <><Text style={[muted, { marginTop: 12 }]}>{billToConfirm.name} · {formatPolishMonth(selectedMonth)}</Text><Text style={fieldLabel}>{billToConfirm.expectedAmount ? "Kwota miesięczna" : "Zapłacona kwota"}</Text>{billToConfirm.expectedAmount ? <Text style={billFixedAmount}>{formatPln(moneyToGrosz(billToConfirm.expectedAmount))}</Text> : <TextInput accessibilityLabel="Zapłacona kwota opłaty" value={billAmountDraft} onChangeText={setBillAmountDraft} keyboardType="decimal-pad" placeholder="np. 500,00" style={input} />}<Pressable accessibilityRole="button" disabled={billSaving} onPress={() => void confirmBillPayment()} style={[primaryButton, billSaving && disabledButton]}><Text style={primaryText}>{billSaving ? "Zapisywanie…" : "Potwierdź opłacenie"}</Text></Pressable></> : null}
      </View></SafeAreaView>
    </Modal>

    <Modal visible={billAddOpen} transparent animationType="fade" onRequestClose={() => setBillAddOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={modalBackdrop}><View style={modalPanel}>
        <ModalHeader title="Nowa cykliczna opłata" onClose={() => setBillAddOpen(false)} />
        <Text style={fieldLabel}>Mieszkanie</Text>
        <View style={billPropertyChoices}>{activeProperties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: billPropertyDraft === property.id }} onPress={() => setBillPropertyDraft(property.id)} style={[billPropertyChoice, billPropertyDraft === property.id && billPropertyChoiceSelected]}><Text style={billPropertyChoiceText} numberOfLines={1}>{property.address}</Text></Pressable>)}</View>
        <Text style={fieldLabel}>Nazwa opłaty</Text><TextInput accessibilityLabel="Nazwa opłaty" value={billNameDraft} onChangeText={setBillNameDraft} placeholder="np. Czynsz administracyjny" style={input} />
        <Text style={fieldLabel}>Kwota miesięczna (opcjonalnie)</Text><TextInput accessibilityLabel="Kwota miesięczna opłaty" value={billExpectedDraft} onChangeText={setBillExpectedDraft} keyboardType="decimal-pad" placeholder="Zmienna kwota" style={input} />
        <Text style={fieldLabel}>Termin płatności — dzień miesiąca</Text><TextInput accessibilityLabel="Dzień terminu opłaty" value={billDueDayDraft} onChangeText={(value) => setBillDueDayDraft(value.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" maxLength={2} style={input} />
        <Text style={helperText}>Przypomnienie pojawi się w terminie. Opłata pozostanie do potwierdzenia, dopóki nie zapiszesz płatności.</Text>
        <Pressable accessibilityRole="button" onPress={() => void saveRecurringBill()} style={primaryButton}><Text style={primaryText}>Zapisz opłatę</Text></Pressable>
      </View></SafeAreaView>
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
function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) { return <View style={modalHeader}><Text style={modalTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={onClose} style={modalCloseButton}><Text style={modalCloseText}>Zamknij</Text></Pressable></View>; }
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
const welcomeContent = { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 };
const welcomeInner = { width: "100%" as const, maxWidth: 980, alignSelf: "center" as const, justifyContent: "center" as const, gap: 28 };
const welcomeHeading = { alignItems: "center" as const, gap: 9, maxWidth: 680, alignSelf: "center" as const, marginBottom: 4 };
const welcomeEyebrow = { color: theme.colors.primary, fontSize: 12, fontWeight: "800" as const, letterSpacing: 1.1 };
const welcomeTitle = { color: theme.colors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: "800" as const, textAlign: "center" as const };
const welcomeSubtitle = { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: "center" as const };
const welcomeChoices = { flexDirection: "row" as const, alignItems: "stretch" as const, gap: 18 };
const welcomeChoicesNarrow = { flexDirection: "column" as const };
const welcomeChoice = { ...ui.card, flex: 1, minHeight: 250, padding: 24, marginVertical: 0, justifyContent: "space-between" as const, gap: 22, borderRadius: 22 };
const welcomeChoiceNarrow = { minHeight: 205, padding: 20 };
const welcomePrimaryChoice = { borderColor: "#F2C8D1", backgroundColor: theme.colors.surface };
const welcomeIcon = { width: 58, height: 58, borderRadius: 18, backgroundColor: theme.colors.accentSoft, alignItems: "center" as const, justifyContent: "center" as const };
const welcomeDemoIcon = { backgroundColor: theme.colors.background };
const welcomeCopy = { gap: 8 };
const welcomeChoiceTitle = { color: theme.colors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: "700" as const };
const welcomeChoiceDescription = { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, maxWidth: 390 };
const welcomeAction = { minHeight: 50, borderRadius: 12, paddingHorizontal: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10, backgroundColor: theme.colors.background };
const welcomePrimaryAction = { backgroundColor: theme.colors.primary };
const welcomeDemoAction = { backgroundColor: theme.colors.background };
const welcomeActionPrimary = { color: theme.colors.onAccent, fontWeight: "700" as const, fontSize: 14 };
const welcomeActionSecondary = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 14 };
const privacyNote = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 9, alignSelf: "center" as const, maxWidth: 600, marginTop: 4 };
const privacyText = { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" as const, flexShrink: 1 };
const sectionTitle = ui.sectionTitle;
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const smallLabel = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" as const };
const fieldLabel = { ...ui.fieldLabel, marginTop: 8 };
const helperText = { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };
const sectionHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 6 };
const dashboardSectionTitle = { ...ui.sectionTitle, marginTop: 12, marginBottom: 8 };
const emptyText = { color: theme.colors.textSecondary, backgroundColor: theme.colors.surface, padding: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 15, marginVertical: 6, fontSize: 14 };
const summaryCard = { paddingHorizontal: 16, paddingVertical: 14, marginVertical: 4 };
const summaryEyebrow = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.5 };
const summaryHeroValue = { color: theme.colors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: "800" as const, marginTop: 3 };
const summaryDetail = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, marginTop: 3 };
const summaryExpected = { color: theme.colors.textSecondary, fontSize: 14, marginTop: 3 };
const summaryPaidRow = { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 1 };
const summaryPaid = { color: theme.colors.success, fontSize: 13, fontWeight: "700" as const };
const ownerNetBlock = { width: "100%" as const };
const ownerNetValue = { color: theme.colors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: "800" as const, marginTop: 3 };
const ownerYtdValue = { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" as const, marginTop: 2 };
const ownerNetDetail = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 };
const apartmentListCard = { padding: 14, marginTop: 4 };
const apartmentRentSummary = { gap: 4, paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const rentSummaryHeading = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
const apartmentListRow = { paddingVertical: 10, paddingHorizontal: 4, minHeight: 68 };
const apartmentListDivider = { borderTopWidth: 1, borderTopColor: theme.colors.divider };
const propertyRow = { paddingVertical: 13, paddingHorizontal: 15, marginTop: 7, minHeight: 76 };
const compactPropertyHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 };
const propertyName = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" as const };
const compactTenant = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 };
const compactMuted = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const };
const compactAmount = { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "800" as const, textAlign: "right" as const, alignSelf: "flex-end" as const, minWidth: 110, marginTop: 5 };
const overdueMeta = { color: theme.colors.warning, fontSize: 11, fontWeight: "600" as const, textAlign: "right" as const, marginTop: 2 };
const bulkListContent = { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 };
const bulkHint = { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 };
const bulkSelectAllRow = { minHeight: 56, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, borderRadius: 12, backgroundColor: theme.colors.surfaceMuted, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 };
const bulkApartmentRow = { minHeight: 68, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 4 };
const bulkApartmentRowSelected = { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.selectedBorder };
const bulkApartmentDetails = { flex: 1, minWidth: 0 };
const bulkSelectAllLabel = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const, flex: 1 };
const bulkSelectAllAmount = { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" as const };
const bulkItemName = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const bulkAmount = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const bulkFooter = { borderTopWidth: 1, borderTopColor: theme.colors.divider, backgroundColor: theme.colors.background, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 };
const paymentActionRow = { flexDirection: "row" as const, gap: 10, marginTop: 8 };
const paymentActionRowStacked = { flexDirection: "column" as const };
const paymentActionCard = { flex: 1, minWidth: 0, padding: 12, marginVertical: 4, minHeight: 104 };
const paymentActionHeading = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 };
const paymentActionAmount = { color: theme.colors.textPrimary, fontSize: 20, lineHeight: 25, fontWeight: "800" as const, marginTop: 7, fontVariant: ["tabular-nums"] as const };
const paymentActionStatus = { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 4 };
const paymentActionStatusPaid = { color: theme.colors.success, fontWeight: "700" as const };
const paymentActionStatusOverdue = { color: theme.colors.danger, fontWeight: "700" as const };
const billListContent = { paddingHorizontal: 20, paddingVertical: 14 };
const billListRow = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, minHeight: 76, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const billListDetails = { flex: 1 };
const billListStatus = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const, marginTop: 5 };
const billFixedAmount = { color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceMuted, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, marginTop: 6, marginBottom: 12, fontSize: 16, fontWeight: "700" as const };
const billConfirmLink = { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.colors.accentSoft };
const billConfirmLinkText = { color: theme.colors.primary, fontSize: 13, fontWeight: "700" as const };
const billAddButton = { marginTop: 16 };
const billPropertyChoices = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7, marginTop: 5, marginBottom: 8 };
const billPropertyChoice = { maxWidth: "100%" as const, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, paddingHorizontal: 10, paddingVertical: 8 };
const billPropertyChoiceSelected = { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.selectedBorder };
const billPropertyChoiceText = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" as const };
const disabledButton = { opacity: 0.5 };
const setupReminderRow = { minHeight: 44, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingHorizontal: 4 };
const actionStyle = { color: theme.colors.primary, fontWeight: "700" as const };
const emptyRow = { gap: 7, marginTop: 4 };
const modalBackdrop = { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center" as const, padding: 18 };
const modalPanel = { backgroundColor: theme.colors.modalBackground, borderRadius: 18, padding: 18, maxHeight: "85%" as const };
const modalHeader = { ...ui.modalHeader, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 12 };
const modalTitle = { ...ui.modalTitle, fontSize: 18 };
const modalCloseButton = { minHeight: 40, justifyContent: "center" as const, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.accentSoft };
const modalCloseText = { color: theme.colors.primary, fontSize: 14, fontWeight: "700" as const };
const modalAction = { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const input = { ...ui.input, paddingHorizontal: 12, marginTop: 6, marginBottom: 12 };
const primaryButton = { ...ui.primaryButton, marginTop: 10 };
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const };
const overpaymentWarning = { color: theme.colors.warning, fontSize: 12, fontWeight: "600" as const, marginTop: 8 };
