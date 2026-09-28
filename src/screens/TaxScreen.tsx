import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { calculateSettlements, formatPln, formatPlnAmount, settlementPeriodForMonth } from "../domain/ryczaltTax";
import { isPositiveMoney, isValidCalendarDate } from "../domain/rentalValidation";
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
import { formatPolishDate } from "../domain/presentationFormat";
import { annualRentalIncome, annualRentalThreshold, dashboardProgress } from "../domain/rentalPresentation";
import { shiftTaxPeriod, taxPaymentDisplay, taxPeriodLabel, taxRateLabel } from "../domain/taxPresentation";
import { ProgressBar } from "../components/ProgressBar";

export function TaxScreen() {
  const { document, error, update } = useRentalData();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [selectedPeriod, setSelectedPeriod] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", paidAt: todayIsoDate() });
  const [editing, setEditing] = useState<TaxPayment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const taxYear = Number(selectedPeriod.slice(0, 4));
  const settlements = useMemo(() => document && (taxYear === 2025 || taxYear === 2026) ? calculateSettlements({
    entries: document.incomeEntries,
    payments: document.taxPayments,
    taxYear,
    mode: document.settings.settlementMode,
    jointSpouseThreshold: document.settings.jointSpouseThreshold,
  }) : [], [document, taxYear]);
  useEffect(() => {
    if (document?.settings.settlementMode === "quarterly" && /^\d{4}-\d{2}$/.test(selectedPeriod)) {
      setSelectedPeriod((period) => settlementPeriodForMonth(period, "quarterly") ?? period);
    }
  }, [document, selectedPeriod]);
  useEffect(() => {
    const period = (route.params as { period?: string } | undefined)?.period;
    if (!document || !period) return;
    const year = Number(period.slice(0, 4));
    const part = period.slice(5);
    setSelectedPeriod(`${year}-${part.startsWith("Q") ? part : part.padStart(2, "0")}`);
    navigation.setParams({ period: undefined });
  // Notification reminders pass a settlement period to open directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
  if (!document) return error
    ? <View style={{ padding: 24 }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text></View>
    : <ActivityIndicator style={{ flex: 1 }} />;
  const activeIndex = settlements.findIndex((item) => item.period === selectedPeriod);
  const settlement = activeIndex < 0 ? undefined : settlements[activeIndex];
  const payments = settlement ? document.taxPayments.filter((item) => item.period === settlement.period).sort((a, b) => b.paidAt.localeCompare(a.paidAt)) : [];
  const paymentPrompt = settlement ? taxPaymentPrompt(settlement.outstandingGrosz, settlement.overpaidGrosz, settlement.obligationGrosz) : null;
  const paymentDisplay = settlement ? taxPaymentDisplay(settlement, payments[0]?.paidAt) : null;
  const openPayment = (payment?: TaxPayment) => {
    setEditing(payment ?? null);
    setPaymentDraft(payment ? { amount: payment.amount, paidAt: payment.paidAt } : { amount: "", paidAt: todayIsoDate() });
    setModalOpen(true);
  };
  const savePayment = async () => {
    const amount = paymentDraft.amount.trim().replace(",", ".");
    if (!isPositiveMoney(amount) || !isValidCalendarDate(paymentDraft.paidAt)) {
      Alert.alert("Sprawdź dane wpłaty", "Kwota musi być dodatnia (maks. 2 miejsca po przecinku), a data rzeczywista w formacie RRRR-MM-DD.");
      return;
    }
    if (!settlement) return;
    const next: TaxPayment = { id: editing?.id ?? createId("tax"), period: settlement.period, paidAt: paymentDraft.paidAt, amount };
    setSaving(true);
    try {
      await update((current) => upsertTaxPayment(current, next));
      setModalOpen(false);
      setEditing(null);
    } catch { /* The provider reports persistence failure. */ }
    finally { setSaving(false); }
  };
  const deletePayment = (payment: TaxPayment) => Alert.alert("Usunąć potwierdzenie wpłaty?", `${formatPlnAmount(payment.amount)} z dnia ${formatPolishDate(payment.paidAt, "long")}.`, [
    { text: "Anuluj", style: "cancel" },
    { text: "Usuń", style: "destructive", onPress: () => void update((current) => removeTaxPayment(current, payment.id)).catch(() => undefined) },
  ]);
  const annualIncome = annualRentalIncome(document.incomeEntries, taxYear);
  const annualThreshold = annualRentalThreshold(taxYear, document.settings.jointSpouseThreshold);
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
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" }}>Podatek</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni okres" onPress={() => setSelectedPeriod((period) => shiftTaxPeriod(period, -1, document.settings.settlementMode))}><Text style={[action, { fontSize: 20, paddingHorizontal: 8 }]}>‹</Text></Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "700", fontSize: 16 }}>{taxPeriodLabel(selectedPeriod, document.settings.settlementMode)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Następny okres" onPress={() => setSelectedPeriod((period) => shiftTaxPeriod(period, 1, document.settings.settlementMode))}><Text style={[action, { fontSize: 20, paddingHorizontal: 8 }]}>›</Text></Pressable>
      </View>
      <Text style={muted}>Rozliczenie {document.settings.settlementMode === "monthly" ? "miesięczne" : "kwartalne"}</Text>
      {!settlement || !Number.isInteger(taxYear) ? null : <>
        <View style={[ui.card, { marginTop: 12 }]}>
          {paymentDisplay?.kind === "no-tax" ? <Text style={{ color: theme.colors.textSecondary, fontWeight: "700" }}>Brak podatku do zapłaty</Text> : paymentDisplay?.kind === "paid" ? <>
            <Text style={{ color: theme.colors.success, fontWeight: "800", letterSpacing: 0.3 }}>✓ PODATEK OPŁACONY</Text>
            <Text style={dueValue}>{formatPln(paymentDisplay.amountGrosz)}</Text>
            <Text style={{ color: theme.colors.success, marginTop: 4 }}>{paymentDisplay.paidAt ? formatPolishDate(paymentDisplay.paidAt, "long") : "Rozliczono nadpłatą"}</Text>
          </> : <>
            <Text style={dueLabel}>DO ZAPŁATY</Text>
            <Text style={[dueValue, { fontSize: 32, marginTop: 6 }]}>{formatPln(paymentDisplay?.amountGrosz ?? 0)}</Text>
            <Text style={{ color: paymentDisplay?.kind === "overdue" ? theme.colors.warning : theme.colors.textSecondary, fontWeight: "600", marginTop: 5 }}>{paymentDisplay?.kind === "overdue" ? "Termin minął " : "do "}{formatPolishDate(settlement.dueDate, "long")}</Text>
            {paymentDisplay && paymentDisplay.paidGrosz > 0 ? <Text style={taxContext}>Zapłacono {formatPln(paymentDisplay.paidGrosz)} z {formatPln(paymentDisplay.obligationGrosz)}</Text> : null}
          </>}
          {settlement.overpaidGrosz > 0 ? <Text style={taxContext}>Nadpłata {formatPln(settlement.overpaidGrosz)}</Text> : null}
          <Text style={taxContext}>Przychód {formatPln(settlement.revenueGrosz)} · {taxRateLabel(settlement.taxableBaseGrosz, annualThreshold)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setPaymentDetailsOpen(true)} style={transferRow}><Text style={action}>Dane do przelewu</Text><Text style={action}>›</Text></Pressable>
        {paymentPrompt?.showPayment ? <Pressable accessibilityRole="button" onPress={() => openPayment()} style={primaryButton}><Text style={primaryText}>Potwierdź zapłatę</Text></Pressable> : null}
        <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 18 }}>Przychód w {taxYear}</Text>
        <Text style={taxContext}>{formatPln(annualIncome)} / próg {annualThreshold > 0 ? formatPln(annualThreshold) : "niedostępny"}</Text>
        {annualThreshold > 0 ? <View style={{ marginTop: 8 }}><ProgressBar fraction={annualProgress.fraction} quiet accessibilityLabel="Przychód względem progu rocznego" /></View> : null}
        {payments.length ? <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 18 }}>Historia wpłat</Text> : null}
        {payments.map((payment) => <View key={payment.id} style={[ui.card, { padding: 14, marginTop: 8 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary }}>{formatPolishDate(payment.paidAt, "long")}</Text><Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{formatPlnAmount(payment.amount)}</Text></View>
          <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}><Text accessibilityRole="button" onPress={() => openPayment(payment)} style={action}>Popraw</Text><Text accessibilityRole="button" onPress={() => deletePayment(payment)} style={{ ...action, color: theme.colors.danger }}>Usuń</Text></View>
        </View>)}
      </>}
      {!settlement && !([2025, 2026] as number[]).includes(taxYear) ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 18 }}>Brak zweryfikowanych reguł podatkowych dla roku {taxYear}. Dane pojawią się po dodaniu reguł dla tego roku.</Text> : null}
      <View style={taxDetails}><Text style={muted}>ⓘ Podatek wyliczony z potwierdzonych wpływów. Sprawdź indywidualne odliczenia i swoją sytuację przed zapłatą.</Text><Pressable accessibilityRole="button" accessibilityState={{ expanded: infoOpen }} onPress={() => setInfoOpen((open) => !open)}><Text style={[action, { marginTop: 4 }]}>Jak liczymy? {infoOpen ? "⌃" : "⌄"}</Text></Pressable>{infoOpen ? <Text style={muted}>Podatek w tym widoku jest obliczany z potwierdzonych wpływów dla wybranego okresu, z uwzględnieniem zapisanych wpłat i ustawionego progu stawki. Sprawdź indywidualne odliczenia i swoją sytuację przed zapłatą.</Text> : null}</View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
    </ScrollView>
    <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>{editing ? "Popraw potwierdzenie" : "Potwierdź zapłatę"}</Text><Text accessibilityRole="button" onPress={() => setModalOpen(false)} style={action}>Zamknij</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>Okres rozliczenia</Text><Text style={{ color: theme.colors.textPrimary, marginBottom: 18 }}>{settlement?.period ?? ""}</Text>
          <Text style={fieldLabel}>Kwota faktycznie zapłacona (zł)</Text><TextInput accessibilityLabel="Kwota faktycznie zapłacona" keyboardType="decimal-pad" value={paymentDraft.amount} onChangeText={(amount) => setPaymentDraft((current) => ({ ...current, amount }))} placeholder="np. 212,50" style={inputStyle} />
          <Text style={fieldLabel}>Data wpłaty (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Data wpłaty" value={paymentDraft.paidAt} onChangeText={(paidAt) => setPaymentDraft((current) => ({ ...current, paidAt }))} placeholder="2026-10-20" style={inputStyle} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void savePayment()} style={[primaryButton, saving && { opacity: 0.6 }]}><Text style={primaryText}>{saving ? "Zapisywanie…" : editing ? "Zapisz poprawki" : "Potwierdź zapłatę"}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <Modal visible={paymentDetailsOpen} animationType="slide" onRequestClose={() => setPaymentDetailsOpen(false)}>
      <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>Dane przelewu</Text><Text accessibilityRole="button" onPress={() => setPaymentDetailsOpen(false)} style={action}>Zamknij</Text></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
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
const muted = { color: theme.colors.textSecondary, marginTop: 6, fontSize: 14 };
const primaryButton = ui.primaryButton;
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const, fontSize: 15 };
const dueLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5 };
const dueValue = { color: theme.colors.textPrimary, fontSize: 25, fontWeight: "800" as const, marginTop: 3 };
const taxContext = { color: theme.colors.textMuted, fontSize: 12, marginTop: 12 };
const transferRow = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const taxDetails = { marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface };
const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
