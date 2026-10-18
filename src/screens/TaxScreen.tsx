import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { calculateTaxYear, formatPln, formatPlnAmount, hasTaxRulesForYear, moneyToGrosz, settlementPeriodForMonth, taxRulesAreProvisional, taxRulesYearFor } from "../domain/ryczaltTax";
import { isFullPaymentAmount, isNonnegativeMoney, isPositiveMoney, isValidCalendarDate } from "../domain/rentalValidation";
import * as Clipboard from "expo-clipboard";
import { missingPaymentDetails } from "../domain/paymentDetails";
import { removeTaxPayment, upsertTaxPayment } from "../domain/taxPayment";
import type { TaxPayment } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { PaymentDetail } from "../components/PaymentDetail";
import { SafeAreaView } from "react-native-safe-area-context";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import { taxPaymentPrompt } from "../domain/rentalPresentation";
import { formatPolishCount, formatPolishDate } from "../domain/presentationFormat";
import { annualRentalIncome, annualRentalThreshold, dashboardProgress } from "../domain/rentalPresentation";
import { currentTaxPeriod, remainingTaxThresholdGrosz, shiftTaxPeriodWithinRange, TAX_CALCULATION_EXPLANATION, TAX_TRANSFER_HINT, taxPaymentDisplay, taxPeriodLabel, taxRateLabel } from "../domain/taxPresentation";
import { ProgressBar } from "../components/ProgressBar";
import { PeriodSelector } from "../components/PeriodSelector";
import { earliestDashboardMonth } from "../domain/dashboardPeriods";
import { decimalFromGrosz } from "../domain/apartmentPayments";
import { refreshSavedTaxSettlementsAfterPayment, taxSettlementFromSnapshot } from "../domain/periodSnapshots";
import { rentMonthStatusRows } from "../domain/incomeHistory";

export function TaxScreen() {
  const { document, error, update } = useRentalData();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", paidAt: todayIsoDate() });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [annualOpen, setAnnualOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [historyReviewOpen, setHistoryReviewOpen] = useState(false);
  const closeConfirmationFlow = () => {
    setModalOpen(false);
    setHistoryReviewOpen(false);
    if (returnToTab) {
      const tab = returnToTab;
      setReturnToTab(null);
      navigation.navigate(tab);
    }
  };
  const settlementMode = document?.settings.settlementMode ?? "monthly";
  const now = new Date();
  const currentYearStart = `${now.getFullYear()}-01`;
  const earliestMonth = document ? earliestDashboardMonth(document.properties, document.incomeEntries, now, currentYearStart) : currentYearStart;
  const earliestPeriod = document ? settlementPeriodForMonth(earliestMonth, settlementMode) ?? currentYearStart : currentYearStart;
  const taxYear = Number(selectedPeriod.slice(0, 4));
  const persistedTaxSnapshot = document?.taxSettlementSnapshots?.find((snapshot) => snapshot.period === selectedPeriod);
  const calculation = useMemo(() => document && hasTaxRulesForYear(taxYear) ? calculateTaxYear({
    entries: document.incomeEntries,
    payments: document.taxPayments,
    taxYear,
    mode: document.settings.settlementMode,
    jointSpouseThreshold: document.settings.jointSpouseThreshold,
    openingTaxableRevenueGrosz: document.settings.taxYear === taxYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0,
    openingTaxPaidGrosz: document.settings.taxYear === taxYear && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0,
  }) : undefined, [document, taxYear]);
  const settlements = calculation?.settlements ?? [];
  useEffect(() => {
    const params = route.params as { period?: string; openPaymentConfirmation?: boolean; returnTo?: string } | undefined;
    const period = params?.period;
    if (!document || (!period && !params?.openPaymentConfirmation)) return;
    const year = period ? Number(period.slice(0, 4)) : Number(selectedPeriod.slice(0, 4));
    const part = period?.slice(5) ?? selectedPeriod.slice(5);
    const requested = part.startsWith("Q") ? `${year}-${part}` : settlementPeriodForMonth(`${year}-${part.padStart(2, "0")}`, document.settings.settlementMode) ?? selectedPeriod;
    const latest = currentTaxPeriod(now, document.settings.settlementMode);
    const targetPeriod = requested > latest ? latest : requested < earliestPeriod ? earliestPeriod : requested;
    setSelectedPeriod(targetPeriod);
    if (params?.openPaymentConfirmation) {
      setReturnToTab(params.returnTo ?? null);
      const targetYear = Number(targetPeriod.slice(0, 4));
      const snapshot = document.taxSettlementSnapshots?.find((item) => item.period === targetPeriod);
      const targetCalculation = hasTaxRulesForYear(targetYear) ? calculateTaxYear({
        entries: document.incomeEntries, payments: document.taxPayments, taxYear: targetYear,
        mode: document.settings.settlementMode, jointSpouseThreshold: document.settings.jointSpouseThreshold,
        openingTaxableRevenueGrosz: document.settings.taxYear === targetYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0,
        openingTaxPaidGrosz: document.settings.taxYear === targetYear && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0,
      }) : undefined;
      const targetSettlement = snapshot ? taxSettlementFromSnapshot(snapshot, todayIsoDate()) : targetCalculation?.settlements.find((item) => item.period === targetPeriod);
      const returnTo = params.returnTo;
      if (!targetSettlement || targetSettlement.outstandingGrosz <= 0) {
        setReturnToTab(null);
        if (returnTo) navigation.navigate(returnTo);
      } else {
        const openConfirmation = () => {
          const priorPeriodsForTarget = targetCalculation?.settlements.filter((item) => item.period < targetPeriod) ?? [];
          const priorRevenue = (targetCalculation?.openingBalance.taxableRevenueGrosz ?? 0) + priorPeriodsForTarget.reduce((sum, item) => sum + item.revenueGrosz, 0);
          const hasPriorRent = document.properties.some((property) => {
            const hasRent = Boolean(property.ownerRent || property.rentSchedule?.length);
            const startMonth = property.rentalStartDate?.slice(0, 7) ?? property.rentSchedule?.[0]?.effectiveFrom ?? `${targetYear}-01`;
            return hasRent && startMonth < targetPeriod;
          });
          const hasPaymentThisYear = document.taxPayments.some((item) => item.period.startsWith(`${targetYear}-`)) || (targetCalculation?.openingBalance.paidTaxGrosz ?? 0) > 0;
          setPaymentDraft({ amount: decimalFromGrosz(targetSettlement.outstandingGrosz), paidAt: todayIsoDate() });
          if (!hasPaymentThisYear && (priorRevenue > 0 || hasPriorRent)) setHistoryReviewOpen(true);
          else setModalOpen(true);
        };
        const unconfirmedRentCount = document.settings.settlementMode === "monthly"
          ? rentMonthStatusRows(document.properties, document.incomeEntries, targetPeriod).filter((row) => row.status === "unpaid").length
          : 0;
        if (unconfirmedRentCount > 0) {
          Alert.alert(
            "Nie wszystkie wpłaty są potwierdzone",
            `${formatPolishCount(unconfirmedRentCount, ["mieszkanie czeka", "mieszkania czekają", "mieszkań czeka"])} na potwierdzenie. Podatek jest wyliczony tylko z potwierdzonych wpłat. Jeśli czynsz został otrzymany, należny podatek może się zwiększyć.`,
            [
              { text: "Sprawdź wpłaty", style: "cancel", onPress: () => { setReturnToTab(null); navigation.navigate("Przychód"); } },
              { text: "Kontynuuj mimo to", onPress: openConfirmation },
            ],
          );
        } else openConfirmation();
      }
    }
    navigation.setParams({ period: undefined, openPaymentConfirmation: undefined, returnTo: undefined });
  // Notification reminders pass a settlement period to open directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, earliestPeriod, navigation, route.params]);
  if (!document) return error
    ? <View style={{ padding: 24 }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text></View>
    : <ActivityIndicator style={{ flex: 1 }} />;
  const settlement = persistedTaxSnapshot ? taxSettlementFromSnapshot(persistedTaxSnapshot, todayIsoDate()) : settlements.find((item) => item.period === selectedPeriod);
  const payments = settlement ? document.taxPayments.filter((item) => item.period === settlement.period).sort((a, b) => b.paidAt.localeCompare(a.paidAt)) : [];
  const paymentPrompt = settlement ? taxPaymentPrompt(settlement.outstandingGrosz, settlement.overpaidGrosz, settlement.obligationGrosz) : null;
  const paymentDisplay = settlement ? taxPaymentDisplay(settlement) : null;
  const unconfirmedRentRows = settlementMode === "monthly"
    ? rentMonthStatusRows(document.properties, document.incomeEntries, selectedPeriod).filter((row) => row.status === "unpaid")
    : [];
  const unconfirmedRentCount = unconfirmedRentRows.length;
  const openPayment = () => {
    setPaymentDraft({ amount: decimalFromGrosz(settlement?.outstandingGrosz ?? 0), paidAt: todayIsoDate() });
    setModalOpen(true);
  };
  const priorPeriods = settlements.filter((item) => item.period < selectedPeriod);
  const priorSnapshots = new Map((document.taxSettlementSnapshots ?? []).filter((item) => item.rulesYear === taxYear && item.period < selectedPeriod).map((item) => [item.period, item]));
  const priorRevenueGrosz = (calculation?.openingBalance.taxableRevenueGrosz ?? 0) + priorPeriods.reduce((sum, item) => sum + item.revenueGrosz, 0);
  const priorObligationGrosz = priorPeriods.reduce((sum, item) => sum + moneyToGrosz(priorSnapshots.get(item.period)?.obligation ?? decimalFromGrosz(item.obligationGrosz)), 0);
  const priorPaidGrosz = (calculation?.openingBalance.paidTaxGrosz ?? 0) + document.taxPayments.filter((item) => item.period < selectedPeriod && item.period.startsWith(`${taxYear}-`)).reduce((sum, item) => sum + moneyToGrosz(item.amount), 0);
  const priorOutstandingGrosz = priorPeriods.reduce((sum, item) => sum + moneyToGrosz(priorSnapshots.get(item.period)?.outstanding ?? decimalFromGrosz(item.outstandingGrosz)), 0);
  const hasTaxYearPayment = document.taxPayments.some((item) => item.period.startsWith(`${taxYear}-`)) || (calculation?.openingBalance.paidTaxGrosz ?? 0) > 0;
  const hasEarlierRentalPeriods = document.properties.some((property) => {
    const hasConfiguredRent = Boolean(property.ownerRent || property.rentSchedule?.length);
    const startMonth = property.rentalStartDate?.slice(0, 7) ?? property.rentSchedule?.[0]?.effectiveFrom ?? `${taxYear}-01`;
    return hasConfiguredRent && startMonth < selectedPeriod;
  });
  const proceedToPaymentWithHistoryReview = () => {
    if (!hasTaxYearPayment && (priorRevenueGrosz > 0 || hasEarlierRentalPeriods)) {
      setHistoryReviewOpen(true);
      return;
    }
    openPayment();
  };
  const openPaymentWithHistoryReview = () => {
    if (unconfirmedRentCount === 0) {
      proceedToPaymentWithHistoryReview();
      return;
    }
    Alert.alert(
      "Nie wszystkie wpłaty są potwierdzone",
      `${formatPolishCount(unconfirmedRentCount, ["mieszkanie czeka", "mieszkania czekają", "mieszkań czeka"])} na potwierdzenie. Podatek jest wyliczony tylko z potwierdzonych wpłat. Jeśli czynsz został otrzymany, należny podatek może się zwiększyć.`,
      [
        { text: "Sprawdź wpłaty", style: "cancel", onPress: () => navigation.navigate("Przychód") },
        { text: "Kontynuuj mimo to", onPress: proceedToPaymentWithHistoryReview },
      ],
    );
  };
  const continueAfterHistoryReview = () => {
    // Reviewing history never manufactures tax-payment records. The user confirms
    // the actual amount and date in the payment form that follows.
    setHistoryReviewOpen(false);
    openPayment();
  };
  const savePayment = async () => {
    const amount = paymentDraft.amount.trim().replace(",", ".");
    if (!isPositiveMoney(amount) || !isValidCalendarDate(paymentDraft.paidAt)) {
      Alert.alert("Sprawdź dane wpłaty", "Kwota musi być dodatnia (maks. 2 miejsca po przecinku), a data rzeczywista w formacie RRRR-MM-DD.");
      return;
    }
    if (!settlement) return;
    if (!isFullPaymentAmount(amount, settlement.outstandingGrosz)) {
      Alert.alert("Potwierdź pełną wpłatę", "Można potwierdzić tylko całą pozostałą kwotę podatku.");
      return;
    }
    const next: TaxPayment = { id: createId("tax"), period: settlement.period, paidAt: paymentDraft.paidAt, amount };
    setSaving(true);
    try {
      await update((current) => refreshSavedTaxSettlementsAfterPayment(upsertTaxPayment(current, next), settlement.period));
      closeConfirmationFlow();
    } catch { /* The provider reports persistence failure. */ }
    finally { setSaving(false); }
  };
  const deletePayment = (payment: TaxPayment) => Alert.alert("Usunąć potwierdzenie wpłaty?", `${formatPlnAmount(payment.amount)} z dnia ${formatPolishDate(payment.paidAt, "long")}.`, [
    { text: "Anuluj", style: "cancel" },
    { text: "Usuń", style: "destructive", onPress: () => void update((current) => refreshSavedTaxSettlementsAfterPayment(removeTaxPayment(current, payment.id), payment.period)).catch(() => undefined) },
  ]);
  const annualIncome = annualRentalIncome(document.incomeEntries, taxYear, document.settings.taxYear === taxYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0);
  const annualThreshold = annualRentalThreshold(taxYear, document.settings.jointSpouseThreshold);
  const remainingThreshold = remainingTaxThresholdGrosz(annualIncome, annualThreshold);
  const annualProgress = dashboardProgress(annualIncome, annualThreshold);
  const taxPaymentDetails = {
    recipientName: document.settings.taxRecipientName,
    bankAccount: document.settings.taxMicroAccount,
    amount: formatPln(settlement?.outstandingGrosz ?? 0).replace(" zł", "").replace(/\s/g, "").replace(",", "."),
    dueDate: settlement?.dueDate,
  };
  const missingTaxDetails = missingPaymentDetails(taxPaymentDetails).filter((item) => item !== "tytuł płatności" && (settlement?.outstandingGrosz || item !== "kwota większa od zera"));
  const copyDetail = async (value: string | undefined, label: string) => {
    if (!value) return;
    try { await Clipboard.setStringAsync(value); Alert.alert("Skopiowano", label); }
    catch { Alert.alert("Nie udało się skopiować", "Skopiuj dane ręcznie."); }
  };

  return <View style={ui.page}>
    <ScrollView contentContainerStyle={{ ...ui.content, paddingBottom: 36 }}>
      <PeriodSelector value={taxPeriodLabel(selectedPeriod, document.settings.settlementMode)} valueLabel={`Okres ${taxPeriodLabel(selectedPeriod, document.settings.settlementMode)}`} previousLabel="Poprzedni okres" nextLabel="Następny okres"
        previousDisabled={selectedPeriod <= earliestPeriod} nextDisabled={selectedPeriod >= currentTaxPeriod(now, document.settings.settlementMode)}
        onPrevious={() => setSelectedPeriod((period) => shiftTaxPeriodWithinRange(period, -1, document.settings.settlementMode, now, earliestPeriod))}
        onNext={() => setSelectedPeriod((period) => shiftTaxPeriodWithinRange(period, 1, document.settings.settlementMode, now, earliestPeriod))} />
      {!settlement || !Number.isInteger(taxYear) ? null : <>
        {taxRulesAreProvisional(taxYear) ? <View accessibilityRole="alert" style={[ui.card, { marginTop: 10, borderColor: theme.colors.warning }]}><Text style={{ color: theme.colors.warning, fontWeight: "700" }}>Stawki na {taxYear} nie zostały jeszcze potwierdzone. Obliczenie wykorzystuje zasady z {taxRulesYearFor(taxYear)}. Sprawdź przed zapłatą.</Text></View> : null}
        <View style={[ui.card, taxHeroCard]}>
          {paymentDisplay?.kind === "no-tax" ? <>
            <Text style={dueLabel}>PODATEK</Text>
            <Text style={noTaxValue}>Brak podatku do zapłaty</Text>
          </> : <>
            <Text style={dueLabel}>PODATEK</Text>
            <Text style={dueValue}>{formatPln(paymentDisplay?.obligationGrosz ?? 0)}</Text>
            {paymentDisplay?.kind === "paid"
              ? <View style={paidStatusRow}><MaterialIcons name="check-circle" size={16} color={theme.colors.success} /><Text style={paidStatus}>Opłacone</Text></View>
              : <Text style={[taxStatus, paymentDisplay?.kind === "overdue" && { color: theme.colors.warning }]}>{`Pozostało ${formatPln(paymentDisplay?.remainingGrosz ?? 0)}`}</Text>}
            {paymentDisplay?.kind !== "paid" && (paymentDisplay?.paidGrosz ?? 0) > 0 ? <Text style={taxContextCompact}>Zapłacono {formatPln(paymentDisplay?.paidGrosz ?? 0)}</Text> : null}
            {paymentDisplay?.kind !== "paid" ? <Text style={[taxDeadline, paymentDisplay?.kind === "overdue" && { color: theme.colors.warning }]}>{paymentDisplay?.kind === "overdue" ? "Termin minął " : "Termin "}{formatPolishDate(settlement.dueDate, "long")}</Text> : null}
          </>}
          {settlement.overpaidGrosz > 0 ? <Text style={taxContextCompact}>Nadpłata {formatPln(settlement.overpaidGrosz)}</Text> : null}
          <Text style={taxBaseLine}>Przychód {formatPln(settlement.revenueGrosz)} · {taxRateLabel(settlement.cumulativeRevenueGrosz, annualThreshold)}</Text>
        </View>
        {document.settings.taxYear === taxYear && calculation && (calculation.openingBalance.taxableRevenueGrosz > 0 || calculation.openingBalance.paidTaxGrosz > 0) ? <View accessibilityLabel="Zagregowany stan podatku sprzed śledzenia" style={[ui.card, { marginTop: 8, padding: 14 }]}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Stan początkowy roku · bez przypisanego okresu</Text>
          <Text style={taxContext}>Wcześniejszy przychód {formatPln(calculation.openingBalance.taxableRevenueGrosz)} · wyliczony podatek {formatPln(calculation.openingBalance.calculatedTaxGrosz)} · zapłacono {formatPln(calculation.openingBalance.paidTaxGrosz)}</Text>
          {calculation.openingBalance.outstandingGrosz > 0 ? <Text style={taxContext}>Różnica stanu początkowego: {formatPln(calculation.openingBalance.outstandingGrosz)}. Nie przypisano jej do miesięcznego terminu.</Text> : null}
          {calculation.openingBalance.overpaidGrosz > 0 ? <Text style={taxContext}>Nadpłata stanu początkowego: {formatPln(calculation.openingBalance.overpaidGrosz)}. Nie przypisano jej do miesięcznego okresu.</Text> : null}
        </View> : null}
        {unconfirmedRentCount > 0 ? <View style={rentWarning}>
          <Text style={rentWarningTitle}>{formatPolishCount(unconfirmedRentCount, ["czynsz czeka na potwierdzenie", "czynsze czekają na potwierdzenie", "czynszów czeka na potwierdzenie"])}</Text>
          <Text style={rentWarningText}>Podatek obejmuje tylko potwierdzone wpłaty.</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Przychód")}><Text style={action}>Sprawdź wpłaty ›</Text></Pressable>
        </View> : null}
        {paymentPrompt?.showPayment ? <Pressable accessibilityRole="button" onPress={openPaymentWithHistoryReview} style={primaryButton}><Text style={primaryText}>Potwierdź wykonaną wpłatę</Text></Pressable> : null}
        {paymentPrompt?.showPayment ? <Pressable accessibilityRole="button" accessibilityLabel={`Dane do przelewu. ${TAX_TRANSFER_HINT}`} onPress={() => setPaymentDetailsOpen(true)} style={transferRow}><View><Text style={transferTitle}>Dane do przelewu</Text><Text style={transferHint}>{TAX_TRANSFER_HINT}</Text></View><Text style={action}>›</Text></Pressable> : null}
        <View style={compactSection}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: annualOpen }} accessibilityLabel={`Rok ${taxYear}, przychód opodatkowany ${formatPln(annualIncome)}`} onPress={() => setAnnualOpen((open) => !open)} style={disclosureRow}>
            <View style={{ flex: 1 }}>
              <Text style={disclosureTitle}>Rok {taxYear}</Text>
              <Text style={disclosureSummary}>{annualThreshold > 0 ? `${formatPln(annualIncome)} / ${formatPln(annualThreshold)}` : formatPln(annualIncome)}</Text>
            </View>
            <MaterialIcons name={annualOpen ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
          </Pressable>
          {annualThreshold > 0 ? <ProgressBar fraction={annualProgress.fraction} quiet accessibilityLabel="Wykorzystanie progu stawki 12,5%" /> : null}
          {annualOpen && annualThreshold > 0 ? <Text style={thresholdRemaining}>Do progu stawki 12,5%: {formatPln(remainingThreshold)}</Text> : null}
        </View>
        {payments.length ? <View style={compactSection}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: paymentHistoryOpen }} accessibilityLabel={`Historia płatności, ${payments.length}`} onPress={() => setPaymentHistoryOpen((open) => !open)} style={disclosureRow}>
            <Text style={disclosureTitle}>Historia płatności ({payments.length})</Text>
            <MaterialIcons name={paymentHistoryOpen ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
          </Pressable>
          {paymentHistoryOpen ? <>
            <Text style={taxHint}>Wpłaty rozliczamy od najstarszej nieopłaconej należności.</Text>
            {payments.map((payment) => <View key={payment.id} style={paymentHistoryRow}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: theme.colors.textPrimary, flex: 1 }}>{formatPolishDate(payment.paidAt, "long")}{payment.source === "INITIAL_IMPORT" ? " · data szacunkowa" : ""}</Text><Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{formatPlnAmount(payment.amount)}</Text></View>
              {payment.source === "INITIAL_IMPORT" ? <Text style={taxContextCompact}>Potwierdzono zapłatę podczas uzupełniania historii; dokładna data nie była znana.</Text> : null}
              {persistedTaxSnapshot ? <Text style={taxHint}>Okres zamknięty · usunięcie wpłaty niedostępne</Text> : <Pressable accessibilityRole="button" onPress={() => deletePayment(payment)} style={secondaryPaymentAction}><Text style={[secondaryPaymentActionText, { color: theme.colors.danger }]}>Usuń</Text></Pressable>}
            </View>)}
          </> : null}
        </View> : null}
      </>}
      {!settlement && !hasTaxRulesForYear(taxYear) ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 18 }}>Brak zweryfikowanych reguł podatkowych dla roku {taxYear}. Możesz przeglądać okres, ale wyliczenie będzie dostępne po weryfikacji reguł.</Text> : null}
      <View style={taxDetails}><Pressable accessibilityRole="button" accessibilityLabel="Jak liczymy podatek?" accessibilityState={{ expanded: infoOpen }} onPress={() => setInfoOpen((open) => !open)} style={infoRow}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={[infoTitle, infoOpen && { marginBottom: 5 }]}>ⓘ Jak liczymy podatek?</Text><MaterialIcons name={infoOpen ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} /></View></Pressable>{infoOpen ? <Text style={infoBody}>{TAX_CALCULATION_EXPLANATION}</Text> : null}</View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
    </ScrollView>
    <Modal visible={historyReviewOpen} animationType="slide" onRequestClose={closeConfirmationFlow}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={ui.modalHeader}><Text style={ui.modalTitle}>Sprawdź podatek od początku roku</Text><Text accessibilityRole="button" onPress={closeConfirmationFlow} style={action}>Zamknij</Text></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={taxContext}>Zanim potwierdzisz pierwszą wpłatę w aplikacji, sprawdź wcześniejsze wpływy i rozliczenia. Kwoty podatku pochodzą z wyliczenia dla wpływów zapisanych w aplikacji. Jeśli brakuje wcześniejszych wpływów, dodaj je lub popraw w zakładce Przychód przed kontynuacją.</Text>
          <View style={[ui.card, { marginTop: 16, padding: 16, gap: 8 }]}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Od początku {taxYear}, przed okresem {taxPeriodLabel(selectedPeriod, document.settings.settlementMode)}</Text>
            <Text style={taxContext}>Przychód opodatkowany: {formatPln(priorRevenueGrosz)}</Text>
            <Text style={taxContext}>Wyliczony podatek: {formatPln(priorObligationGrosz)}</Text>
            <Text style={taxContext}>Zapisane wpłaty podatku: {formatPln(priorPaidGrosz)}</Text>
            <Text style={{ color: priorOutstandingGrosz > 0 ? theme.colors.warning : theme.colors.success, fontWeight: "700" }}>Pozostało według zapisanych danych: {formatPln(priorOutstandingGrosz)}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { setHistoryReviewOpen(false); navigation.navigate("Przychód"); }} style={{ minHeight: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, paddingHorizontal: 16, marginTop: 12 }}><Text style={{ color: theme.colors.textPrimary, fontWeight: "600", textAlign: "center" }}>Sprawdź lub popraw wpływy</Text></Pressable>
          <Text style={[taxHint, { marginTop: 16 }]}>Aplikacja nie zakłada, że wcześniejszy podatek został zapłacony. Jeśli chcesz uzupełnić historyczną wpłatę podatku, wybierz odpowiedni okres i potwierdź pełną pozostałą kwotę oraz rzeczywistą datę zapłaty.</Text>
          <Pressable accessibilityRole="button" disabled={saving} onPress={continueAfterHistoryReview} style={[primaryButton, { marginTop: 16 }, saving && { opacity: 0.5 }]}><Text style={primaryText}>Dalej do potwierdzenia bieżącej wpłaty</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <Modal visible={modalOpen} animationType="slide" onRequestClose={closeConfirmationFlow}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={ui.modalHeader}><Text style={ui.modalTitle}>Potwierdź wykonaną wpłatę</Text><Text accessibilityRole="button" onPress={closeConfirmationFlow} style={action}>Zamknij</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>Okres rozliczenia</Text><Text style={{ color: theme.colors.textPrimary, marginBottom: 18 }}>{settlement?.period ?? ""}</Text>
          <Text style={fieldLabel}>Pełna pozostała kwota podatku (zł)</Text><Text accessibilityLabel="Pełna pozostała kwota podatku" style={[inputStyle, { paddingTop: 14 }]}>{isNonnegativeMoney(paymentDraft.amount) ? formatPlnAmount(paymentDraft.amount) : "—"}</Text>
          <Text style={fieldLabel}>Data wpłaty (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Data wpłaty" value={paymentDraft.paidAt} onChangeText={(paidAt) => setPaymentDraft((current) => ({ ...current, paidAt }))} placeholder="2026-10-20" style={inputStyle} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void savePayment()} style={[primaryButton, saving && { opacity: 0.6 }]}><Text style={primaryText}>{saving ? "Zapisywanie…" : "Potwierdź wykonaną wpłatę"}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <Modal visible={paymentDetailsOpen} animationType="slide" onRequestClose={() => setPaymentDetailsOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>Dane przelewu</Text><Text accessibilityRole="button" onPress={() => setPaymentDetailsOpen(false)} style={action}>Zamknij</Text></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <PaymentDetail label="Symbol formularza płatności" value="PPE" onCopy={() => void copyDetail("PPE", "Symbol formularza")} />
          <PaymentDetail label="Okres rozliczenia" value={settlement ? taxPeriodLabel(settlement.period, document.settings.settlementMode) : undefined} onCopy={() => void copyDetail(settlement ? taxPeriodLabel(settlement.period, document.settings.settlementMode) : undefined, "Okres rozliczenia")} />
          <PaymentDetail label="Odbiorca" value={taxPaymentDetails.recipientName} onCopy={() => void copyDetail(taxPaymentDetails.recipientName, "Odbiorca")} />
          <PaymentDetail label="Mikrorachunek podatkowy" value={taxPaymentDetails.bankAccount} onCopy={() => void copyDetail(taxPaymentDetails.bankAccount, "Mikrorachunek")} />
          <PaymentDetail label="Kwota do zapłaty" value={settlement && settlement.outstandingGrosz > 0 ? formatPln(settlement.outstandingGrosz) : "Brak kwoty do zapłaty"} onCopy={() => void copyDetail(settlement?.outstandingGrosz ? taxPaymentDetails.amount : undefined, "Kwota")} />
          <PaymentDetail label="Termin płatności" value={taxPaymentDetails.dueDate ? formatPolishDate(taxPaymentDetails.dueDate, "long") : undefined} onCopy={() => void copyDetail(taxPaymentDetails.dueDate, "Termin płatności")} />
          {missingTaxDetails.length ? <Pressable accessibilityRole="button" onPress={() => { setPaymentDetailsOpen(false); navigation.navigate("Ustawienia", { settingsSection: "payment" }); }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 12 }}>Skonfiguruj lub popraw: {missingTaxDetails.join(", ")} w Ustawieniach ›</Text></Pressable> : null}
          <Text style={{ ...muted, marginTop: 16 }}>Tytuł ani identyfikator przelewu nie są skonfigurowane w aplikacji. Kod QR nie jest generowany; sprawdź wymagane dane w banku i rachunek przed zleceniem przelewu.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const secondaryPaymentAction = { minWidth: 56, minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 8 };
const secondaryPaymentActionText = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "500" as const };
const muted = { color: theme.colors.textSecondary, marginTop: 6, fontSize: 14 };
const settlementContext = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 0 };
const primaryButton = ui.primaryButton;
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const, fontSize: 15 };
const dueLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5 };
const taxHeroCard = { marginTop: 10, padding: 16 };
const dueValue = { color: theme.colors.textPrimary, fontSize: 36, lineHeight: 42, fontWeight: "800" as const, marginTop: 5 };
const noTaxValue = { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" as const, marginTop: 6 };
const paidStatusRow = { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, marginTop: 5 };
const paidStatus = { color: theme.colors.success, fontSize: 14, fontWeight: "700" as const };
const taxStatus = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const, marginTop: 5 };
const taxDeadline = { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" as const, marginTop: 4 };
const taxBaseLine = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 10 };
const taxContextCompact = { color: theme.colors.textMuted, fontSize: 12, marginTop: 5 };
const taxContext = { color: theme.colors.textMuted, fontSize: 12, marginTop: 12 };
const taxHint = { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 };
const transferRow = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const transferTitle = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const transferHint = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 };
const thresholdRemaining = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 7 };
const compactSection = { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface };
const disclosureRow = { minHeight: 44, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 };
const disclosureTitle = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const };
const disclosureSummary = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 };
const paymentHistoryRow = { borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: 10, marginTop: 8 };
const infoTitle = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, paddingVertical: 2 };
const infoRow = { minHeight: 44, justifyContent: "center" as const };
const infoBody = { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 };
const taxDetails = { marginTop: 14, padding: 11, borderRadius: 12, backgroundColor: theme.colors.surface };
const rentWarning = { marginTop: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: theme.colors.surface };
const rentWarningTitle = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const };
const rentWarningText = { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 6 };
const fieldLabel = { ...ui.fieldLabel, marginTop: 12 };
const inputStyle = { ...ui.input, paddingVertical: 10 };
