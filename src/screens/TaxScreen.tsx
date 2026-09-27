import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import { calculateSettlements, formatPln, SUPPORTED_TAX_YEARS } from "../domain/ryczaltTax";
import { isPositiveMoney, isValidCalendarDate } from "../domain/rentalValidation";
import * as Clipboard from "expo-clipboard";
import { missingPaymentDetails } from "../domain/paymentDetails";
import { removeTaxPayment, upsertTaxPayment } from "../domain/taxPayment";
import type { TaxPayment } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { PaymentDetail } from "../components/PaymentDetail";

const statusLabel = { "no-tax": "Brak podatku do zapłaty", due: "Do zapłaty", partial: "Częściowo zapłacono", paid: "Zapłacono", overdue: "Po terminie" } as const;

export function TaxScreen() {
  const { document, error, update } = useRentalData();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [periodIndex, setPeriodIndex] = useState<number | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", paidAt: todayIsoDate() });
  const [editing, setEditing] = useState<TaxPayment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const taxYear = selectedYear ?? document?.settings.taxYear ?? new Date().getFullYear();
  const settlements = useMemo(() => document && (taxYear === 2025 || taxYear === 2026) ? calculateSettlements({
    entries: document.incomeEntries,
    payments: document.taxPayments,
    taxYear,
    mode: document.settings.settlementMode,
    jointSpouseThreshold: document.settings.jointSpouseThreshold,
  }) : [], [document, taxYear]);
  useEffect(() => {
    const period = (route.params as { period?: string } | undefined)?.period;
    if (!document || !period) return;
    const year = Number(period.slice(0, 4));
    const part = period.slice(5);
    setSelectedYear(year);
    setPeriodIndex(part.startsWith("Q") ? Number(part.slice(1)) - 1 : Number(part) - 1);
    navigation.setParams({ period: undefined });
  // Notification reminders pass a settlement period to open directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
  if (!document) return error
    ? <View style={{ padding: 24 }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text></View>
    : <ActivityIndicator style={{ flex: 1 }} />;
  const activeIndex = periodIndex ?? Math.min(new Date().getFullYear() === taxYear
    ? (document.settings.settlementMode === "monthly" ? new Date().getMonth() : Math.floor(new Date().getMonth() / 3))
    : settlements.length - 1, settlements.length - 1);
  const settlement = settlements[activeIndex];
  const payments = settlement ? document.taxPayments.filter((item) => item.period === settlement.period).sort((a, b) => b.paidAt.localeCompare(a.paidAt)) : [];
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
  const deletePayment = (payment: TaxPayment) => Alert.alert("Usunąć potwierdzenie wpłaty?", `${payment.amount} zł z dnia ${payment.paidAt}.`, [
    { text: "Anuluj", style: "cancel" },
    { text: "Usuń", style: "destructive", onPress: () => void update((current) => removeTaxPayment(current, payment.id)).catch(() => undefined) },
  ]);
  const changeYear = (year: number) => {
    setSelectedYear(year);
    setPeriodIndex(null);
  };
  const taxPaymentDetails = {
    recipientName: document.settings.taxRecipientName,
    bankAccount: document.settings.taxMicroAccount,
    amount: formatPln(settlement?.outstandingGrosz ?? 0).replace(" zł", "").replace(/\s/g, "").replace(",", "."),
    title: settlement ? `PPE ${settlement.period}` : undefined,
    dueDate: settlement?.dueDate,
  };
  const missingTaxDetails = missingPaymentDetails(taxPaymentDetails);
  const copyDetail = async (value: string | undefined, label: string) => {
    if (!value) return;
    try { await Clipboard.setStringAsync(value); Alert.alert("Skopiowano", label); }
    catch { Alert.alert("Nie udało się skopiować", "Skopiuj dane ręcznie."); }
  };

  return <View style={ui.page}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" }}>Podatek</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12 }}>
        <Pressable accessibilityRole="button" disabled={taxYear <= Math.min(...SUPPORTED_TAX_YEARS)} onPress={() => changeYear(taxYear - 1)}><Text style={[action, taxYear <= Math.min(...SUPPORTED_TAX_YEARS) && { opacity: 0.4 }]}>‹</Text></Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{taxYear}</Text>
        <Pressable accessibilityRole="button" disabled={taxYear >= Math.max(...SUPPORTED_TAX_YEARS)} onPress={() => changeYear(taxYear + 1)}><Text style={[action, taxYear >= Math.max(...SUPPORTED_TAX_YEARS) && { opacity: 0.4 }]}>›</Text></Pressable>
        {taxYear !== document.settings.taxYear ? <Pressable accessibilityRole="button" onPress={() => changeYear(document.settings.taxYear)}><Text style={action}>Ustawiony</Text></Pressable> : null}
      </View>
      <Text style={muted}>Rozliczenie {document.settings.settlementMode === "monthly" ? "miesięczne" : "kwartalne"} · próg {document.settings.jointSpouseThreshold ? "200 000" : "100 000"} zł</Text>
      {!settlement || !Number.isInteger(taxYear) ? null : <>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
          <Pressable accessibilityRole="button" disabled={activeIndex === 0} onPress={() => setPeriodIndex(Math.max(0, activeIndex - 1))}><Text style={[action, activeIndex === 0 && { opacity: 0.35 }]}>‹ Poprzedni</Text></Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" }}>{settlement.period}</Text>
          <Pressable accessibilityRole="button" disabled={activeIndex === settlements.length - 1} onPress={() => setPeriodIndex(Math.min(settlements.length - 1, activeIndex + 1))}><Text style={[action, activeIndex === settlements.length - 1 && { opacity: 0.35 }]}>Następny ›</Text></Pressable>
        </View>
        <View style={[ui.card, { marginTop: 12 }]}>
          <Metric label="Przychód" value={formatPln(settlement.revenueGrosz)} />
          <Metric label="Ryczałt" value={formatPln(settlement.obligationGrosz)} strong />
          <Metric label="Zapłacono" value={formatPln(settlement.paidGrosz)} />
          <View style={dueAmount}><Text style={dueLabel}>{settlement.overpaidGrosz ? "NADPŁATA" : "DO ZAPŁATY"}</Text><Text style={dueValue}>{formatPln(settlement.overpaidGrosz || settlement.outstandingGrosz)}</Text></View>
          <Text style={{ color: settlement.status === "overdue" ? theme.colors.danger : theme.colors.textSecondary, fontWeight: "600", marginTop: 10 }}>Termin · {settlement.dueDate}</Text>
          <Text style={taxContext}>Rocznie: {formatPln(settlement.cumulativeRevenueGrosz)} / {formatPln(document.settings.jointSpouseThreshold ? 20_000_000 : 10_000_000)}</Text>
          {settlement.status === "no-tax" || settlement.status === "paid" || settlement.status === "overdue" ? <Text style={{ color: settlement.status === "overdue" ? theme.colors.danger : theme.colors.success, fontWeight: "700", marginTop: 8 }}>{statusLabel[settlement.status]}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => openPayment()} style={primaryButton}><Text style={primaryText}>＋ Potwierdź wpłatę podatku</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPaymentDetailsOpen(true)} style={transferRow}><Text style={action}>Dane do przelewu podatku</Text><Text style={action}>›</Text></Pressable>
          {payments.length ? <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700", marginTop: 18 }}>Wpłaty w okresie</Text> : null}
        {payments.length === 0 ? <Text style={{ ...ui.emptyState, color: theme.colors.textSecondary }}>Brak potwierdzonych wpłat.</Text> : payments.map((payment) => <View key={payment.id} style={[ui.card, { padding: 14 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary }}>{payment.paidAt}</Text><Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{payment.amount} zł</Text></View>
          <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}><Text accessibilityRole="button" onPress={() => openPayment(payment)} style={action}>Popraw</Text><Text accessibilityRole="button" onPress={() => deletePayment(payment)} style={{ ...action, color: theme.colors.danger }}>Usuń</Text></View>
        </View>)}
      </>}
      {!([2025, 2026] as number[]).includes(taxYear) ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 18 }}>Brak zweryfikowanych reguł podatkowych dla roku {taxYear}. Wybierz 2025 lub 2026.</Text> : null}
      <View style={taxDetails}><Text style={muted}>ⓘ  Podatek jest liczony z potwierdzonych wpływów. Sprawdź indywidualne odliczenia i swoją sytuację przed zapłatą.</Text></View>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
    </ScrollView>
    <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>{editing ? "Popraw wpłatę podatku" : "Potwierdź wpłatę podatku"}</Text><Text accessibilityRole="button" onPress={() => setModalOpen(false)} style={action}>Zamknij</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>Okres rozliczenia</Text><Text style={{ color: theme.colors.textPrimary, marginBottom: 18 }}>{settlement?.period ?? ""}</Text>
          <Text style={fieldLabel}>Kwota faktycznie zapłacona (zł)</Text><TextInput accessibilityLabel="Kwota faktycznie zapłacona" keyboardType="decimal-pad" value={paymentDraft.amount} onChangeText={(amount) => setPaymentDraft((current) => ({ ...current, amount }))} placeholder="np. 212,50" style={inputStyle} />
          <Text style={fieldLabel}>Data wpłaty (RRRR-MM-DD)</Text><TextInput accessibilityLabel="Data wpłaty" value={paymentDraft.paidAt} onChangeText={(paidAt) => setPaymentDraft((current) => ({ ...current, paidAt }))} placeholder="2026-10-20" style={inputStyle} />
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void savePayment()} style={[primaryButton, saving && { opacity: 0.6 }]}><Text style={primaryText}>{saving ? "Zapisywanie…" : editing ? "Zapisz poprawki" : "Potwierdź wpłatę podatku"}</Text></Pressable>
        </ScrollView>
      </View>
    </Modal>
    <Modal visible={paymentDetailsOpen} animationType="slide" onRequestClose={() => setPaymentDetailsOpen(false)}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>Dane przelewu</Text><Text accessibilityRole="button" onPress={() => setPaymentDetailsOpen(false)} style={action}>Zamknij</Text></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <PaymentDetail label="Odbiorca" value={taxPaymentDetails.recipientName} onCopy={() => void copyDetail(taxPaymentDetails.recipientName, "Odbiorca")} />
          <PaymentDetail label="Mikrorachunek podatkowy" value={taxPaymentDetails.bankAccount} onCopy={() => void copyDetail(taxPaymentDetails.bankAccount, "Mikrorachunek")} />
          <PaymentDetail label="Kwota pozostała" value={`${formatPln(settlement?.outstandingGrosz ?? 0)}`} onCopy={() => void copyDetail(taxPaymentDetails.amount, "Kwota")} />
          <PaymentDetail label="Tytuł płatności" value={taxPaymentDetails.title} onCopy={() => void copyDetail(taxPaymentDetails.title, "Tytuł płatności")} />
          <PaymentDetail label="Termin płatności" value={taxPaymentDetails.dueDate} onCopy={() => void copyDetail(taxPaymentDetails.dueDate, "Termin płatności")} />
          {missingTaxDetails.length ? <Pressable accessibilityRole="button" onPress={() => { setPaymentDetailsOpen(false); navigation.navigate("Ustawienia", { settingsSection: "payment" }); }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 12 }}>Skonfiguruj lub popraw: {missingTaxDetails.join(", ")} w Ustawieniach ›</Text></Pressable> : null}
          <Text style={{ ...muted, marginTop: 16 }}>Kod QR nie jest generowany, aby nie podać niekompletnych lub niezgodnych z bankiem danych. Sprawdź rachunek przed zleceniem przelewu.</Text>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}

function Metric({ label, value, strong = false, positive = false }: { label: string; value: string; strong?: boolean; positive?: boolean }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 }}><Text style={{ color: theme.colors.textSecondary, flex: 1 }}>{label}</Text><Text style={{ color: positive ? theme.colors.success : theme.colors.textPrimary, fontWeight: strong ? "700" : "500", textAlign: "right" }}>{value}</Text></View>;
}

const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const muted = { color: theme.colors.textSecondary, marginTop: 6, fontSize: 14 };
const primaryButton = ui.primaryButton;
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const, fontSize: 15 };
const dueAmount = { backgroundColor: theme.colors.surfaceMuted, borderRadius: 12, padding: 12, marginTop: 8 };
const dueLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5 };
const dueValue = { color: theme.colors.textPrimary, fontSize: 25, fontWeight: "800" as const, marginTop: 3 };
const taxContext = { color: theme.colors.textMuted, fontSize: 12, marginTop: 12 };
const transferRow = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const taxDetails = { marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface };
const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
