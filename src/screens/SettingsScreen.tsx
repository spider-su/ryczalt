import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import type { BillPayment, Property, PropertyLink, RecurringBill, RentalDocument } from "../model/rental";
import { theme } from "../theme/theme";
import { isNonnegativeMoney, isPositiveMoney, isValidCalendarDate, isValidHttpsUrl, isValidPolishBankAccount } from "../domain/rentalValidation";
import { SUPPORTED_TAX_YEARS } from "../domain/ryczaltTax";
import { missingPaymentDetails } from "../domain/paymentDetails";
import { useReminders } from "../notifications/ReminderProvider";
import { deriveTasks } from "../domain/tasks";
import { PaymentDetail } from "../components/PaymentDetail";
import { PropertyList } from "../components/settings/PropertyList";
import { RecurringBillList } from "../components/settings/RecurringBillList";
import { blankPropertyDraft, PropertyEditorModal, type PropertyDraft } from "../components/settings/PropertyEditorModal";
import { removePropertyData } from "../domain/rentalOperations";

type BillDraft = { propertyId: string; name: string; recipientName: string; bankAccount: string; paymentTitle: string; expectedAmount: string; dueDay: string; reminderEnabled: boolean; variableAmount: boolean };
const emptyBillDraft: BillDraft = { propertyId: "", name: "", recipientName: "", bankAccount: "", paymentTitle: "", expectedAmount: "", dueDay: "", reminderEnabled: false, variableAmount: false };

export function SettingsScreen() {
  const { document, error, update } = useRentalData();
  const { permission, requestPermission } = useReminders();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [editing, setEditing] = useState<Property | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyDraft>(blankPropertyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [billEditing, setBillEditing] = useState<RecurringBill | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<BillDraft>(emptyBillDraft);
  const [billForDetails, setBillForDetails] = useState<RecurringBill | null>(null);
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [taxRecipient, setTaxRecipient] = useState("");
  const [taxAccount, setTaxAccount] = useState("");
  const [linkDrafts, setLinkDrafts] = useState<PropertyLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState<PropertyLink["category"]>("UTILITY");
  const reminderPlan = useMemo(() => document ? deriveTasks(document).filter((task) => task.status === "upcoming" || task.status === "needs-attention" || task.status === "snoozed") : [], [document]);

  useEffect(() => {
    if (!document) return;
    setTaxRecipient(document.settings.taxRecipientName ?? "");
    setTaxAccount(document.settings.taxMicroAccount ?? "");
    const params = route.params as { propertyId?: string; billId?: string } | undefined;
    const property = params?.propertyId ? document.properties.find((item) => item.id === params.propertyId) : undefined;
    const bill = params?.billId ? document.recurringBills.find((item) => item.id === params.billId) : undefined;
    if (property) openProperty(property);
    if (bill) setBillForDetails(bill);
    if (params?.propertyId || params?.billId) navigation.setParams({ propertyId: undefined, billId: undefined });
  // Route params are consumed once the document has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);
  if (!document)
    return error ? (
      <View style={{ padding: 24 }}>
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      </View>
    ) : (
      <ActivityIndicator style={{ flex: 1 }} />
    );

  const openProperty = (property?: Property) => {
    setEditing(property ?? null);
    setLinkDrafts(property ? document.propertyLinks.filter((link) => link.propertyId === property.id) : []);
    setLinkLabel(""); setLinkUrl(""); setLinkCategory("UTILITY");
    setModalOpen(true);
    setDraft(
      property
        ? {
            name: property.name,
            address: property.address ?? "",
            defaultMonthlyRent: property.defaultMonthlyRent ?? "",
            tenantName: property.tenantName ?? "",
            tenantPhone: property.tenantPhone ?? "",
            tenantEmail: property.tenantEmail ?? "",
            tenantSince: property.tenantSince ?? "",
            rentalEndDate: property.rentalEndDate ?? "",
            rentalEndReminderDays: property.rentalEndReminderDays ?? (property.rentalEndDate ? [30, 7] : [30, 7]),
            expectedPaymentDay: property.expectedPaymentDay?.toString() ?? "",
            paymentReminderEnabled: property.paymentReminderEnabled ?? false,
            paymentReminderDelayDays: property.paymentReminderDelayDays?.toString() ?? "1",
            administratorName: property.administratorName ?? "",
            administratorPortalUrl: property.administratorPortalUrl ?? "",
            administratorPhone: property.administratorPhone ?? "",
            administratorEmail: property.administratorEmail ?? "",
            notes: property.notes ?? "",
          }
        : blankPropertyDraft,
    );
  };
  const save = async () => {
    const name = draft.name.trim();
    const rent = draft.defaultMonthlyRent?.trim() ?? "";
    if (!name) {
      Alert.alert("Brak nazwy", "Wpisz nazwę mieszkania.");
      return;
    }
    if (rent && !isNonnegativeMoney(rent.replace(",", "."))) {
      Alert.alert(
        "Nieprawidłowy czynsz",
        "Wpisz kwotę w formacie 2500 lub 2500,50.",
      );
      return;
    }
    const endDate = draft.rentalEndDate?.trim() ?? "";
    if (endDate && !isValidCalendarDate(endDate)) {
      Alert.alert("Nieprawidłowa data", "Podaj datę końca umowy w formacie RRRR-MM-DD.");
      return;
    }
    const paymentDay = draft.expectedPaymentDay.trim() ? Number(draft.expectedPaymentDay) : undefined;
    const reminderDelay = Number(draft.paymentReminderDelayDays || "1");
    if (paymentDay !== undefined && (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)) {
      Alert.alert("Nieprawidłowy dzień", "Oczekiwany dzień płatności musi być liczbą od 1 do 31.");
      return;
    }
    if (draft.paymentReminderEnabled && paymentDay === undefined) {
      Alert.alert("Brak terminu", "Wpisz oczekiwany dzień płatności, aby włączyć przypomnienie.");
      return;
    }
    if (!Number.isInteger(reminderDelay) || reminderDelay < 0 || reminderDelay > 30) {
      Alert.alert("Nieprawidłowe opóźnienie", "Wybierz opóźnienie od 0 do 30 dni.");
      return;
    }
    const portalUrl = draft.administratorPortalUrl?.trim() ?? "";
    if (portalUrl && !isValidHttpsUrl(portalUrl)) {
      Alert.alert("Nieprawidłowy adres", "Panel administracji musi mieć prawidłowy adres HTTPS.");
      return;
    }
    const property: Property = {
      ...editing,
      id: editing?.id ?? createId("property"),
      name,
      ...optional("address", draft.address),
      ...(rent ? { defaultMonthlyRent: rent.replace(",", "."), rentSchedule: updatedRentSchedule(editing, rent.replace(",", ".")) } : {}),
      ...optional("tenantName", draft.tenantName),
      ...optional("tenantPhone", draft.tenantPhone),
      ...optional("tenantEmail", draft.tenantEmail),
      ...(editing?.tenantSince ? { tenantSince: editing.tenantSince } : {}),
      ...(endDate ? { rentalEndDate: endDate } : { rentalEndDate: undefined }),
      ...(endDate ? { rentalEndReminderDays: draft.rentalEndReminderDays } : { rentalEndReminderDays: [] }),
      ...(paymentDay ? { expectedPaymentDay: paymentDay } : { expectedPaymentDay: undefined }),
      paymentReminderEnabled: draft.paymentReminderEnabled,
      paymentReminderDelayDays: reminderDelay,
      ...optional("administratorName", draft.administratorName),
      ...optional("administratorPortalUrl", portalUrl),
      ...optional("administratorPhone", draft.administratorPhone),
      ...optional("administratorEmail", draft.administratorEmail),
      ...optional("notes", draft.notes),
    };
    const propertyLinks = linkDrafts.map((link) => ({ ...link, propertyId: property.id }));
    setSaving(true);
    try {
      await update((current) => ({
        ...current,
        propertyLinks: [...current.propertyLinks.filter((link) => link.propertyId !== property.id), ...propertyLinks],
        properties: editing
          ? current.properties.map((item) =>
              item.id === editing.id ? property : item,
            )
          : [...current.properties, property],
      }));
      setEditing(null);
      setModalOpen(false);
    } catch {
      /* The provider reports the save failure. */
    } finally {
      setSaving(false);
    }
  };
  const addPropertyLink = () => {
    const label = linkLabel.trim(); const url = linkUrl.trim();
    if (!label || !isValidHttpsUrl(url)) {
      Alert.alert("Nieprawidłowy link", "Podaj nazwę i poprawny adres HTTPS."); return;
    }
    setLinkDrafts((links) => [...links, { id: createId("link"), propertyId: editing?.id ?? "draft-property", label, url, category: linkCategory }]);
    setLinkLabel(""); setLinkUrl("");
  };
  const remove = (property: Property) => {
    if (deletingId) return;
    if (
      document.incomeEntries.some((income) => income.propertyId === property.id)
    ) {
      Alert.alert(
        "Nie można usunąć mieszkania",
        "To mieszkanie ma zapisane wpłaty. Zachowaj je, aby nie utracić historii.",
      );
      return;
    }
    Alert.alert(
      "Usunąć mieszkanie?",
      `Mieszkanie „${property.name}” zostanie usunięte.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () => {
            setDeletingId(property.id);
            void update((current) => removePropertyData(current, property.id))
              .catch(() => undefined)
              .finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };
  const updateTaxSettings = (change: (settings: RentalDocument["settings"]) => RentalDocument["settings"]) => {
    void update((current) => ({
      ...current,
      settings: change(current.settings),
    })).catch(() => undefined);
  };
  const saveTaxPaymentSettings = async () => {
    const account = taxAccount.replace(/\s/g, "");
    if (account && !isValidPolishBankAccount(account)) {
      Alert.alert("Nieprawidłowy rachunek", "Wpisz prawidłowy 26-cyfrowy polski mikrorachunek podatkowy.");
      return;
    }
    try {
      await update((current) => ({ ...current, settings: { ...current.settings, taxRecipientName: taxRecipient.trim(), taxMicroAccount: account } }));
      Alert.alert("Zapisano", "Dane płatności podatku zostały zapisane.");
    } catch { /* The provider reports persistence failure. */ }
  };
  const toggleReminderCategory = (category: keyof RentalDocument["settings"]["reminderCategories"]) => {
    updateTaxSettings((settings) => ({ ...settings, reminderCategories: { ...settings.reminderCategories, [category]: !settings.reminderCategories[category] } }));
  };
  const openBill = (bill?: RecurringBill) => {
    setBillEditing(bill ?? null);
    setBillDraft(bill ? {
      propertyId: bill.propertyId, name: bill.name, recipientName: bill.recipientName ?? "",
      bankAccount: bill.bankAccount ?? "", paymentTitle: bill.paymentTitle ?? "",
      expectedAmount: bill.expectedAmount ?? "", dueDay: bill.dueDay?.toString() ?? "",
      reminderEnabled: bill.reminderEnabled, variableAmount: bill.variableAmount ?? false,
    } : { ...emptyBillDraft, propertyId: document.properties[0]?.id ?? "" });
    setBillModalOpen(true);
  };
  const saveBill = async () => {
    const name = billDraft.name.trim();
    const expectedAmount = billDraft.expectedAmount.trim().replace(",", ".");
    const dueDay = billDraft.dueDay.trim() ? Number(billDraft.dueDay) : undefined;
    if (!name || !document.properties.some((property) => property.id === billDraft.propertyId)) {
      Alert.alert("Sprawdź dane", "Wybierz mieszkanie i podaj nazwę rachunku.");
      return;
    }
    if (billDraft.bankAccount.trim() && !isValidPolishBankAccount(billDraft.bankAccount)) {
      Alert.alert("Nieprawidłowy rachunek", "Numer rachunku musi być prawidłowym polskim numerem NRB.");
      return;
    }
    if (expectedAmount && !isPositiveMoney(expectedAmount)) {
      Alert.alert("Nieprawidłowa kwota", "Wpisz dodatnią kwotę z maksymalnie dwoma miejscami po przecinku.");
      return;
    }
    if (dueDay !== undefined && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      Alert.alert("Nieprawidłowy termin", "Dzień płatności musi być liczbą od 1 do 31.");
      return;
    }
    if (billDraft.reminderEnabled && dueDay === undefined) {
      Alert.alert("Brak terminu", "Wpisz dzień płatności, aby włączyć przypomnienie.");
      return;
    }
    const bill: RecurringBill = {
      id: billEditing?.id ?? createId("bill"), propertyId: billDraft.propertyId, name,
      reminderEnabled: billDraft.reminderEnabled, variableAmount: billDraft.variableAmount,
      ...textValue("recipientName", billDraft.recipientName),
      ...textValue("bankAccount", billDraft.bankAccount.replace(/\s/g, "")),
      ...textValue("paymentTitle", billDraft.paymentTitle),
      ...(expectedAmount ? { expectedAmount } : {}), ...(dueDay ? { dueDay } : {}),
    };
    try {
      await update((current) => ({ ...current, recurringBills: billEditing
        ? current.recurringBills.map((item) => item.id === billEditing.id ? bill : item)
        : [...current.recurringBills, bill] }));
      setBillModalOpen(false);
      setBillEditing(null);
    } catch { /* The provider reports persistence failure. */ }
  };
  const removeBill = (bill: RecurringBill) => Alert.alert("Usunąć rachunek?", bill.name, [
    { text: "Anuluj", style: "cancel" },
    { text: "Usuń", style: "destructive", onPress: () => void update((current) => ({ ...current,
      recurringBills: current.recurringBills.filter((item) => item.id !== bill.id),
      billPayments: current.billPayments.filter((payment) => payment.billId !== bill.id),
    })).catch(() => undefined) },
  ]);
  const openPortal = async (property: Property) => {
    if (!property.administratorPortalUrl) return;
    try { await Linking.openURL(property.administratorPortalUrl); }
    catch { Alert.alert("Nie można otworzyć panelu", "Sprawdź zapisany adres HTTPS."); }
  };
  const copyPaymentValue = async (value: string | undefined, label: string) => {
    if (!value) return;
    try { await Clipboard.setStringAsync(value); Alert.alert("Skopiowano", label); }
    catch { Alert.alert("Nie udało się skopiować", "Skopiuj dane ręcznie."); }
  };
  const confirmBillPayment = async () => {
    if (!billForDetails) return;
    const amount = billPaymentAmount.trim().replace(",", ".");
    if (!isPositiveMoney(amount)) { Alert.alert("Nieprawidłowa kwota", "Wpisz zapłaconą kwotę."); return; }
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const payment: BillPayment = { id: createId("bill-payment"), billId: billForDetails.id, period, paidAt: `${period}-${String(now.getDate()).padStart(2, "0")}`, amount };
    try {
      await update((current) => ({ ...current, billPayments: [...current.billPayments, payment] }));
      setBillForDetails(null);
      setBillPaymentAmount("");
    } catch { /* The provider reports persistence failure. */ }
  };
  const billFields = (label: string, key: keyof BillDraft, keyboardType: "default" | "decimal-pad" | "number-pad" = "default") => (
    <View style={{ marginBottom: 13 }} key={key}>
      <Text style={fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} value={typeof billDraft[key] === "string" ? billDraft[key] as string : ""} onChangeText={(value) => setBillDraft((current) => ({ ...current, [key]: value }))} keyboardType={keyboardType} placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 12 }}>
          Rozliczenie podatku
        </Text>
        <Text style={muted}>Rok podatkowy: {document.settings.taxYear}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginVertical: 10 }}>
          <Pressable accessibilityRole="button" disabled={document.settings.taxYear <= Math.min(...SUPPORTED_TAX_YEARS)} onPress={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear - 1 }))} style={[modeButton, document.settings.taxYear <= Math.min(...SUPPORTED_TAX_YEARS) && { opacity: 0.4 }]}>
            <Text style={modeText}>− Rok</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={document.settings.taxYear >= Math.max(...SUPPORTED_TAX_YEARS)} onPress={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear + 1 }))} style={[modeButton, document.settings.taxYear >= Math.max(...SUPPORTED_TAX_YEARS) && { opacity: 0.4 }]}>
            <Text style={modeText}>+ Rok</Text>
          </Pressable>
        </View>
        <Text style={muted}>Częstotliwość wpłat ryczałtu</Text>
        <View style={{ flexDirection: "row", gap: 10, marginVertical: 10 }}>
          {(["monthly", "quarterly"] as const).map((mode) => (
            <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: document.settings.settlementMode === mode }} onPress={() => {
              if (mode !== document.settings.settlementMode && document.taxPayments.length > 0) {
                Alert.alert("Nie można zmienić okresu", "Dokument zawiera ręcznie przypisane wpłaty podatku. Zmiana częstotliwości mogłaby ukryć ich przypisanie do okresów.");
                return;
              }
              if (mode === "quarterly" && !document.settings.quarterlyEligible) {
                Alert.alert("Kwartalne wpłaty", `Sprawdź, czy spełniasz ustawowe warunki. Jednym z nich jest limit przychodów z poprzedniego roku: równowartość 200 000 EUR (dla rozliczenia ${document.settings.taxYear}: ${document.settings.taxYear === 2025 ? "856 920" : document.settings.taxYear === 2026 ? "851 720" : "sprawdź aktualną kwotę"} zł). Zweryfikuj również pozostałe warunki przed potwierdzeniem.`, [
                  { text: "Anuluj", style: "cancel" },
                  { text: "Potwierdzam", onPress: () => updateTaxSettings((settings) => ({ ...settings, quarterlyEligible: true, settlementMode: "quarterly" })) },
                ]);
              } else updateTaxSettings((settings) => ({ ...settings, settlementMode: mode }));
            }} style={[modeButton, document.settings.settlementMode === mode && { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentSoft }]}>
              <Text style={modeText}>{mode === "monthly" ? "Miesięcznie" : "Kwartalnie"}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: document.settings.jointSpouseThreshold }} onPress={() => Alert.alert(
          "Limit dla małżonków",
          "Wyższy limit 200 000 zł stosuj wyłącznie, jeśli spełniasz warunki wspólności majątkowej i opodatkowania całości przychodów przez jednego małżonka.",
          [{ text: "Anuluj", style: "cancel" }, { text: "Potwierdzam", onPress: () => updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: !settings.jointSpouseThreshold })) }],
        )} style={{ paddingVertical: 10 }}>
          <Text style={muted}>{document.settings.jointSpouseThreshold ? "☑" : "□"} Limit 200 000 zł dla małżonków (warunki ustawowe spełnione)</Text>
        </Pressable>
        <Text style={{ ...muted, marginBottom: 22 }}>Kwartalne rozliczenie wymaga spełnienia warunków ustawowych, w tym limitu przychodów z poprzedniego roku. Zweryfikuj swoje uprawnienie poza aplikacją.</Text>
        <Text style={sectionTitle}>Powiadomienia lokalne</Text>
        <Text style={muted}>{permission === "granted" ? "Powiadomienia systemowe są włączone." : permission === "denied" ? "Brak zgody systemowej. Przypomnienia są nadal widoczne w aplikacji." : permission === "unavailable" ? "Powiadomienia urządzenia są niedostępne w przeglądarce; przypomnienia pozostają widoczne w aplikacji." : "Włącz zgodę systemową, aby otrzymywać przypomnienia poza aplikacją."}</Text>
        {permission !== "granted" && permission !== "unavailable" ? <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={secondaryButton}><Text style={modeText}>Włącz powiadomienia</Text></Pressable> : null}
        {([
          ["rent", "Wpłaty czynszu"], ["agreements", "Kończące się umowy"], ["tax", "Podatek"], ["bills", "Pozostałe rachunki"], ["custom", "Przypomnienia osobiste"],
        ] as const).map(([category, label]) => <Pressable key={category} accessibilityRole="checkbox" accessibilityState={{ checked: document.settings.reminderCategories[category] }} onPress={() => toggleReminderCategory(category)} style={{ paddingVertical: 7 }}><Text style={muted}>{document.settings.reminderCategories[category] ? "☑" : "□"} {label}</Text></Pressable>)}
        <Text style={fieldLabel}>Najbliższe przypomnienia</Text>
        {reminderPlan.length ? reminderPlan.slice(0, 6).map((task) => <Text key={task.id} style={muted}>{task.dueAt.toLocaleDateString("pl-PL")} · {task.title}</Text>) : <Text style={muted}>Brak nadchodzących przypomnień.</Text>}
        <Text style={sectionTitle}>Dane płatności podatku</Text>
        <Text style={muted}>Wpisz dane z własnego mikrorachunku. Aplikacja nie tworzy numeru rachunku ani przelewu.</Text>
        <Text style={fieldLabel}>Odbiorca</Text><TextInput accessibilityLabel="Odbiorca podatku" value={taxRecipient} onChangeText={setTaxRecipient} placeholder="Urząd skarbowy" style={inputStyle} />
        <Text style={fieldLabel}>Mikrorachunek podatkowy</Text><TextInput accessibilityLabel="Mikrorachunek podatkowy" value={taxAccount} onChangeText={setTaxAccount} keyboardType="number-pad" placeholder="26 cyfr" style={inputStyle} />
        <Pressable accessibilityRole="button" onPress={() => void saveTaxPaymentSettings()} style={secondaryButton}><Text style={modeText}>Zapisz dane płatności</Text></Pressable>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: 24,
            fontWeight: "700",
          }}
        >
          Mieszkania
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            marginTop: 6,
            marginBottom: 16,
          }}
        >
          Dane najemcy są zapisane przy mieszkaniu.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => openProperty()}
          style={primaryButton}
        >
          <Text style={primaryText}>＋ Dodaj mieszkanie</Text>
        </Pressable>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.danger, marginVertical: 10 }}
          >
            {error}
          </Text>
        ) : null}
        <PropertyList properties={document.properties} onEdit={openProperty} onRemove={remove} onOpenPortal={(property) => void openPortal(property)} />
        <View style={{ marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={sectionTitle}>Pozostałe rachunki</Text>
          <Pressable accessibilityRole="button" onPress={() => openBill()}><Text style={action}>＋ Dodaj</Text></Pressable>
        </View>
        <RecurringBillList bills={document.recurringBills} properties={document.properties} onDetails={setBillForDetails} onEdit={openBill} onRemove={removeBill} />
      </ScrollView>
      <PropertyEditorModal
        visible={modalOpen} editing={editing} draft={draft} setDraft={setDraft} saving={saving}
        onClose={() => { setModalOpen(false); setEditing(null); }} onSave={() => void save()}
        linkDrafts={linkDrafts} setLinkDrafts={setLinkDrafts} linkLabel={linkLabel} setLinkLabel={setLinkLabel}
        linkUrl={linkUrl} setLinkUrl={setLinkUrl} linkCategory={linkCategory} setLinkCategory={setLinkCategory} onAddLink={addPropertyLink}
      />
      <Modal visible={billModalOpen} animationType="slide" onRequestClose={() => setBillModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={modalHeader}><Text style={modalTitle}>{billEditing ? "Edytuj rachunek" : "Nowy rachunek"}</Text><Text accessibilityRole="button" onPress={() => setBillModalOpen(false)} style={action}>Zamknij</Text></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <Text style={fieldLabel}>Mieszkanie</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{document.properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: billDraft.propertyId === property.id }} onPress={() => setBillDraft((current) => ({ ...current, propertyId: property.id }))} style={[modeButton, billDraft.propertyId === property.id && { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentSoft }]}><Text style={modeText}>{property.name}</Text></Pressable>)}</View>
            {billFields("Nazwa rachunku", "name")}
            {billFields("Odbiorca", "recipientName")}
            {billFields("Polski numer rachunku", "bankAccount")}
            {billFields("Tytuł płatności", "paymentTitle")}
            {billFields("Oczekiwana kwota (zł)", "expectedAmount", "decimal-pad")}
            {billFields("Dzień terminu płatności (1–31)", "dueDay", "number-pad")}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: billDraft.variableAmount }} onPress={() => setBillDraft((current) => ({ ...current, variableAmount: !current.variableAmount }))} style={{ paddingVertical: 8 }}><Text style={muted}>{billDraft.variableAmount ? "☑" : "□"} Kwota zmienna, sprawdzaj ją na bieżąco</Text></Pressable>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: billDraft.reminderEnabled }} onPress={() => setBillDraft((current) => ({ ...current, reminderEnabled: !current.reminderEnabled }))} style={{ paddingVertical: 8 }}><Text style={muted}>{billDraft.reminderEnabled ? "☑" : "□"} Przypominaj o rachunku</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void saveBill()} style={primaryButton}><Text style={primaryText}>Zapisz rachunek</Text></Pressable>
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={Boolean(billForDetails)} animationType="slide" onRequestClose={() => setBillForDetails(null)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={modalHeader}><Text style={modalTitle}>{billForDetails?.name ?? "Szczegóły płatności"}</Text><Text accessibilityRole="button" onPress={() => setBillForDetails(null)} style={action}>Zamknij</Text></View>
          {billForDetails ? <ScrollView contentContainerStyle={{ padding: 20 }}>
            {(() => {
              const property = document.properties.find((item) => item.id === billForDetails.propertyId);
              const details = { recipientName: billForDetails.recipientName, bankAccount: billForDetails.bankAccount, amount: billForDetails.variableAmount ? undefined : billForDetails.expectedAmount, title: billForDetails.paymentTitle, propertyName: property?.name };
              const dueDate = billForDetails.dueDay ? nextBillDueDate(billForDetails.dueDay) : undefined;
              const missing = missingPaymentDetails(details);
              return <>
                <PaymentDetail label="Odbiorca" value={details.recipientName} onCopy={() => void copyPaymentValue(details.recipientName, "Nazwa odbiorcy")} />
                <PaymentDetail label="Numer rachunku" value={details.bankAccount} onCopy={() => void copyPaymentValue(details.bankAccount, "Numer rachunku")} />
                <PaymentDetail label={billForDetails.variableAmount ? "Kwota do sprawdzenia" : "Kwota"} value={details.amount ? `${details.amount} zł` : "Sprawdź bieżącą kwotę"} onCopy={() => void copyPaymentValue(details.amount, "Kwota")} />
                <PaymentDetail label="Tytuł" value={details.title} onCopy={() => void copyPaymentValue(details.title, "Tytuł płatności")} />
                <PaymentDetail label="Termin płatności" value={dueDate} onCopy={() => void copyPaymentValue(dueDate, "Termin płatności")} />
                {missing.length ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 12 }}>Brakuje danych: {missing.join(", ")}.</Text> : null}
                <Text style={{ ...muted, marginTop: 16 }}>Kod QR do polskich aplikacji bankowych nie jest dostępny. Sprawdź dane w panelu administratora przed płatnością.</Text>
                <Text style={fieldLabel}>Kwota faktycznie zapłacona</Text><TextInput accessibilityLabel="Kwota faktycznie zapłacona za rachunek" keyboardType="decimal-pad" value={billPaymentAmount} onChangeText={setBillPaymentAmount} style={inputStyle} />
                <Pressable accessibilityRole="button" onPress={() => void confirmBillPayment()} style={primaryButton}><Text style={primaryText}>Potwierdź opłacenie ręcznie</Text></Pressable>
              </>;
            })()}
          </ScrollView> : null}
        </View>
      </Modal>
    </View>
  );
}

function nextBillDueDate(day: number, now = new Date()): string {
  let year = now.getFullYear();
  let month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let due = new Date(year, month, Math.min(day, daysInMonth), 12);
  if (due < now) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    due = new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);
  }
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" }).format(due);
}

function updatedRentSchedule(property: Property | null, amount: string) {
  const month = todayIsoDate().slice(0, 7);
  const existing = property?.rentSchedule ?? [];
  if (property?.defaultMonthlyRent === amount && existing.some((rate) => rate.effectiveFrom === month && rate.amount === amount)) return existing;
  if (property?.defaultMonthlyRent === amount && existing.length) return existing;
  return [...existing.filter((rate) => rate.effectiveFrom !== month), { effectiveFrom: month, amount }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function optional(
  key:
    | "address"
    | "tenantName"
    | "tenantPhone"
    | "tenantEmail"
    | "tenantSince"
    | "rentalEndDate"
    | "administratorName"
    | "administratorPortalUrl"
    | "administratorPhone"
    | "administratorEmail"
    | "notes",
  value?: string,
): Partial<Property> {
  const trimmed = value?.trim();
  return trimmed ? { [key]: trimmed } : {};
}

function textValue(key: "recipientName" | "bankAccount" | "paymentTitle", value: string): Partial<RecurringBill> {
  const trimmed = value.trim();
  return trimmed ? { [key]: trimmed } : {};
}
const primaryButton = {
  backgroundColor: theme.colors.primary,
  minHeight: 48,
  borderRadius: 8,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  paddingHorizontal: 16,
  marginVertical: 8,
};
const primaryText = {
  color: theme.colors.onAccent,
  fontWeight: "700" as const,
  fontSize: 15,
};
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const action = {
  color: theme.colors.primary,
  fontWeight: "600" as const,
  paddingVertical: 5,
};
const modeButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 };
const modeText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const, marginTop: 22, marginBottom: 8 };
const secondaryButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, minHeight: 44, borderRadius: 8, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 14, marginVertical: 8 };
const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 6 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
const modalHeader = { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const };
const modalTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const };
