import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PaymentDetail } from "../components/PaymentDetail";
import { SafeAreaView } from "react-native-safe-area-context";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import type { Property, PropertyLink, RecurringBill, RentalDocument } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { AGREEMENT_REMINDER_DAYS, isPositiveMoney, isRentalMonth, isValidCalendarDate, isValidHttpsUrl, isValidPolishBankAccount } from "../domain/rentalValidation";
import { missingPaymentDetails } from "../domain/paymentDetails";
import { useReminders } from "../notifications/ReminderProvider";
import { deriveTasks } from "../domain/tasks";
import type { SetupAction } from "../domain/setupProgress";
import { setupActionField } from "../navigation/setupIntent";
import { makeBillPayment } from "../domain/billPayment";
import { settingsSections } from "../domain/rentalPresentation";

type PropertyDraft = Omit<Property, "id" | "expectedPaymentDay" | "paymentReminderEnabled" | "paymentReminderDelayDays" | "rentalEndReminderDays"> & {
  expectedPaymentDay: string;
  paymentReminderEnabled: boolean;
  paymentReminderDelayDays: string;
  rentalEndReminderDays: number[];
};
const blankDraft: PropertyDraft = {
  name: "",
  address: "",
  defaultMonthlyRent: "",
  tenantName: "",
  tenantPhone: "",
  tenantEmail: "",
  tenantSince: "",
  rentalEndDate: "",
  rentalEndReminderDays: [30, 7],
  expectedPaymentDay: "",
  paymentReminderEnabled: false,
  paymentReminderDelayDays: "1",
  administratorName: "",
  administratorPortalUrl: "",
  administratorPhone: "",
  administratorEmail: "",
  notes: "",
};

type BillDraft = { propertyId: string; name: string; recipientName: string; bankAccount: string; paymentTitle: string; expectedAmount: string; dueDay: string; reminderEnabled: boolean; variableAmount: boolean };
const emptyBillDraft: BillDraft = { propertyId: "", name: "", recipientName: "", bankAccount: "", paymentTitle: "", expectedAmount: "", dueDay: "", reminderEnabled: false, variableAmount: false };

export function SettingsScreen() {
  const { document, error, update } = useRentalData();
  const { permission, requestPermission } = useReminders();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const propertyEditorScrollRef = useRef<ScrollView>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [setupFocus, setSetupFocus] = useState<SetupAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyDraft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof settingsSections)[number]["id"] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [billEditing, setBillEditing] = useState<RecurringBill | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<BillDraft>(emptyBillDraft);
  const [billForDetails, setBillForDetails] = useState<RecurringBill | null>(null);
  const [billPaymentPeriod, setBillPaymentPeriod] = useState(() => todayIsoDate().slice(0, 7));
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [taxRecipient, setTaxRecipient] = useState("");
  const [taxAccount, setTaxAccount] = useState("");
  const [linkDrafts, setLinkDrafts] = useState<PropertyLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState<PropertyLink["category"]>("UTILITY");
  const reminderPlan = useMemo(() => document ? deriveTasks(document).filter((task) => task.status === "upcoming" || task.status === "needs-attention" || task.status === "snoozed") : [], [document]);

  useEffect(() => navigation.addListener("blur", () => setActiveSection(null)), [navigation]);

  useEffect(() => {
    if (!document) return;
    setTaxRecipient(document.settings.taxRecipientName ?? "");
    setTaxAccount(document.settings.taxMicroAccount ?? "");
    const params = route.params as { propertyId?: string; billId?: string; period?: string; setupAction?: SetupAction; settingsSection?: (typeof settingsSections)[number]["id"] } | undefined;
    const property = params?.propertyId ? document.properties.find((item) => item.id === params.propertyId) : undefined;
    const bill = params?.billId ? document.recurringBills.find((item) => item.id === params.billId) : undefined;
    if (params?.settingsSection) setActiveSection(params.settingsSection);
    if (params?.setupAction === "apartment" && !params.propertyId) { setActiveSection("properties"); openProperty(undefined, params.setupAction); }
    else if (property) { setActiveSection("properties"); openProperty(property, params?.setupAction); }
    if (bill) {
      setActiveSection("bills");
      setBillPaymentPeriod(params?.period && isRentalMonth(params.period) ? params.period : todayIsoDate().slice(0, 7));
      setBillForDetails(bill);
    }
    if (params?.propertyId || params?.billId || params?.period || params?.setupAction || params?.settingsSection) navigation.setParams({ propertyId: undefined, billId: undefined, period: undefined, setupAction: undefined, settingsSection: undefined });
  // Route params are consumed once the document has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, route.params]);
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

  const openProperty = (property?: Property, focus?: SetupAction) => {
    setEditing(property ?? null);
    setSetupFocus(focus ?? null);
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
        : blankDraft,
    );
  };
  const save = async () => {
    const name = draft.name.trim();
    const rent = draft.defaultMonthlyRent?.trim() ?? "";
    if (!name) {
      Alert.alert("Brak nazwy", "Wpisz nazwę mieszkania.");
      return;
    }
    if (rent && !/^\d+(?:[.,]\d{1,2})?$/.test(rent)) {
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
      setSetupFocus(null);
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
            void update((current) => ({
        ...current,
        recurringBills: current.recurringBills.filter((bill) => bill.propertyId !== property.id),
        billPayments: current.billPayments.filter((payment) => !current.recurringBills.some((bill) => bill.id === payment.billId && bill.propertyId === property.id)),
        propertyLinks: current.propertyLinks.filter((link) => link.propertyId !== property.id),
        properties: current.properties.filter(
                (item) => item.id !== property.id,
              ),
            }))
              .catch(() => undefined)
              .finally(() => setDeletingId(null));
          },
        },
      ],
    );
  };
  const field = (
    label: string,
    key: "name" | "address" | "defaultMonthlyRent" | "tenantName" | "tenantPhone" | "tenantEmail" | "rentalEndDate" | "administratorName" | "administratorPortalUrl" | "administratorPhone" | "administratorEmail" | "notes",
    options: {
      keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad";
      multiline?: boolean;
      placeholder?: string;
    } = {},
  ) => (
    <View style={{ marginBottom: 14 }} key={key} onLayout={setupFocus && setupActionField(setupFocus) === key ? (event) => {
      propertyEditorScrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
      setSetupFocus(null);
    } : undefined}>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: 13,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={draft[key] ?? ""}
        onChangeText={(value) =>
          setDraft((current) => ({ ...current, [key]: value }))
        }
        placeholder={options.placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType={options.keyboardType ?? "default"}
        multiline={options.multiline}
        style={{
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.inputBackground,
          borderColor: theme.colors.inputBorder,
          borderWidth: 1,
          borderRadius: 8,
          minHeight: options.multiline ? 84 : 46,
          paddingHorizontal: 12,
          paddingVertical: 10,
          textAlignVertical: options.multiline ? "top" : "center",
        }}
      />
    </View>
  );
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
  const openBillDetails = (bill: RecurringBill, period = todayIsoDate().slice(0, 7)) => {
    setBillPaymentPeriod(period);
    setBillForDetails(bill);
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
    const payment = makeBillPayment(createId("bill-payment"), billForDetails.id, billPaymentPeriod, amount, todayIsoDate());
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
      <View style={ui.page}>
      <ScrollView contentContainerStyle={{ ...ui.content, paddingBottom: 40 }}>
        {activeSection === null ? <>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700", marginBottom: 12 }}>Ustawienia</Text>
        {settingsSections.map((section) => {
          const summary = section.id === "properties" ? `${document.properties.length} mieszkań`
            : section.id === "tax" ? `Ryczałt · ${document.settings.settlementMode === "monthly" ? "miesięcznie" : "kwartalnie"} · próg ${document.settings.jointSpouseThreshold ? "200 000" : "100 000"} zł`
              : section.id === "payment" ? (document.settings.taxRecipientName && document.settings.taxMicroAccount ? "Dane zapisane" : "Dane wymagają uzupełnienia")
                : section.id === "notifications" ? `${Object.values(document.settings.reminderCategories).filter(Boolean).length} kategorii${permission === "granted" ? " · lokalne ON" : ""}`
                : section.id === "bills" ? `${document.recurringBills.length} rachunków` : "Dane lokalne na tym urządzeniu";
          return <Pressable key={section.id} accessibilityRole="button" onPress={() => setActiveSection(section.id)} style={categoryRow}>
            <View style={{ flex: 1 }}><Text style={categoryLabel}>{section.label}</Text><Text style={muted}>{summary}</Text></View><Text style={action}>›</Text>
          </Pressable>;
        })}
        </> : <>
        <Pressable accessibilityRole="button" onPress={() => setActiveSection(null)} style={settingsBack}><Text style={action}>‹ Ustawienia</Text></Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 12 }}>{settingsSections.find((section) => section.id === activeSection)?.label}</Text>
        {activeSection === "tax" ? <>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginVertical: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni rok podatkowy" disabled={document.settings.taxYear <= 2025} onPress={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear - 1 }))}><Text style={[action, document.settings.taxYear <= 2025 && { opacity: 0.4 }]}>‹</Text></Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{document.settings.taxYear}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Następny rok podatkowy" disabled={document.settings.taxYear >= 2026} onPress={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear + 1 }))}><Text style={[action, document.settings.taxYear >= 2026 && { opacity: 0.4 }]}>›</Text></Pressable>
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
        <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Limit 200 000 zł dla małżonków</Text><Switch value={document.settings.jointSpouseThreshold} onValueChange={(enabled) => {
          if (!enabled) { updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: false })); return; }
          Alert.alert("Limit dla małżonków", "Wyższy limit 200 000 zł stosuj wyłącznie, jeśli spełniasz warunki wspólności majątkowej i opodatkowania całości przychodów przez jednego małżonka.", [
            { text: "Anuluj", style: "cancel" }, { text: "Potwierdzam", onPress: () => updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: true })) },
          ]);
        }} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accent }} thumbColor={theme.colors.surface} accessibilityLabel="Limit 200 000 zł dla małżonków" accessibilityState={{ checked: document.settings.jointSpouseThreshold }} /></View>
        <Text style={{ ...muted, marginTop: -4 }}>Dotyczy wspólności majątkowej i wymaga wyboru opodatkowania całości przychodów z najmu przez jednego małżonka oraz złożenia wymaganego oświadczenia w terminie.</Text>
        <Text style={{ ...muted, marginBottom: 22 }}>Kwartalne rozliczenie wymaga spełnienia warunków ustawowych, w tym limitu przychodów z poprzedniego roku. Zweryfikuj swoje uprawnienie poza aplikacją.</Text>
        </> : null}
        {activeSection === "notifications" ? <>
        <Text style={sectionTitle}>Powiadomienia lokalne</Text>
        <Text style={muted}>{permission === "granted" ? "Powiadomienia systemowe są włączone." : permission === "denied" ? "Brak zgody systemowej. Przypomnienia są nadal widoczne w aplikacji." : permission === "unavailable" ? "Powiadomienia urządzenia są niedostępne w przeglądarce; przypomnienia pozostają widoczne w aplikacji." : "Włącz zgodę systemową, aby otrzymywać przypomnienia poza aplikacją."}</Text>
        {permission !== "granted" && permission !== "unavailable" ? <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={secondaryButton}><Text style={modeText}>Włącz powiadomienia</Text></Pressable> : null}
        {([
          ["rent", "Wpłaty czynszu"], ["agreements", "Kończące się umowy"], ["tax", "Podatek"], ["bills", "Pozostałe rachunki"], ["custom", "Przypomnienia osobiste"],
        ] as const).map(([category, label]) => <View key={category} style={notificationRow}><Text style={{ ...muted, flex: 1 }}>{label}</Text><Switch value={document.settings.reminderCategories[category]} onValueChange={() => toggleReminderCategory(category)} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accent }} thumbColor={theme.colors.surface} accessibilityLabel={label} accessibilityState={{ checked: document.settings.reminderCategories[category] }} /></View>)}
        <Text style={fieldLabel}>Najbliższe przypomnienia</Text>
        {reminderPlan.length ? reminderPlan.slice(0, 6).map((task) => <Text key={task.id} style={muted}>{task.dueAt.toLocaleDateString("pl-PL")} · {task.title}</Text>) : <Text style={muted}>Brak nadchodzących przypomnień.</Text>}
        </> : null}
        {activeSection === "payment" ? <>
        <Text style={muted}>Wpisz dane z własnego mikrorachunku. Aplikacja nie tworzy numeru rachunku ani przelewu.</Text>
        <Text style={fieldLabel}>Odbiorca</Text><TextInput accessibilityLabel="Odbiorca podatku" value={taxRecipient} onChangeText={setTaxRecipient} placeholder="Urząd skarbowy" style={inputStyle} />
        <Text style={fieldLabel}>Mikrorachunek podatkowy</Text><TextInput accessibilityLabel="Mikrorachunek podatkowy" value={taxAccount} onChangeText={setTaxAccount} keyboardType="number-pad" placeholder="26 cyfr" style={inputStyle} />
        <Pressable accessibilityRole="button" onPress={() => void saveTaxPaymentSettings()} style={secondaryButton}><Text style={modeText}>Zapisz dane płatności</Text></Pressable>
        </> : null}
        {activeSection === "properties" ? <>
        <Text
          style={{
            color: theme.colors.textSecondary,
            marginTop: 6,
            marginBottom: 16,
          }}
        >
          Dane najmu i najemcy zapisane przy mieszkaniu.
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
        {document.properties.length === 0 ? (
          <View style={ui.emptyState}><Text style={{ color: theme.colors.textSecondary }}>Nie dodano jeszcze mieszkań.</Text></View>
        ) : (
          document.properties.map((property) => (
          <View
              key={property.id}
              style={ui.card}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontSize: 17,
                      fontWeight: "600",
                    }}
                  >
                    {property.name}
                  </Text>
                  {property.address ? (
                    <Text style={muted}>{property.address}</Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Text
                    onPress={() => openProperty(property)}
                    accessibilityRole="button"
                    style={action}
                  >
                    Edytuj
                  </Text>
                  <Text
                    onPress={() => remove(property)}
                    accessibilityRole="button"
                    style={{ ...action, color: theme.colors.danger }}
                  >
                    Usuń
                  </Text>
                </View>
              </View>
              {property.defaultMonthlyRent ? (
                <Text style={muted}>
                  Domyślny czynsz: {property.defaultMonthlyRent} zł / mies.
                </Text>
              ) : null}
              {property.expectedPaymentDay ? <Text style={muted}>Oczekiwany czynsz: {property.expectedPaymentDay}. dzień miesiąca</Text> : null}
              {property.paymentReminderEnabled ? <Text style={muted}>Przypomnienie: {property.paymentReminderDelayDays ?? 1} dni po terminie</Text> : null}
              {property.tenantName ? (
                <Text style={muted}>Najemca: {property.tenantName}</Text>
              ) : null}
              {property.tenantPhone ? (
                <Text style={muted}>Telefon: {property.tenantPhone}</Text>
              ) : null}
              {property.tenantEmail ? (
                <Text style={muted}>E-mail: {property.tenantEmail}</Text>
              ) : null}
              {property.rentalEndDate ? <Text style={muted}>Umowa do: {property.rentalEndDate}</Text> : null}
              {property.administratorName ? <Text style={muted}>Administracja: {property.administratorName}</Text> : null}
              {property.administratorPhone ? <Text style={muted}>Telefon administracji: {property.administratorPhone}</Text> : null}
              {property.administratorEmail ? <Text style={muted}>E-mail administracji: {property.administratorEmail}</Text> : null}
              {property.administratorPortalUrl ? <Pressable accessibilityRole="link" onPress={() => void openPortal(property)} style={{ paddingVertical: 7 }}><Text style={action}>Otwórz panel administracji</Text></Pressable> : null}
              {property.notes ? (
                <Text style={{ ...muted, marginTop: 5 }}>{property.notes}</Text>
              ) : null}
            </View>
          ))
        )}
        </> : null}
        {activeSection === "bills" ? <>
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
          <Pressable accessibilityRole="button" onPress={() => openBill()}><Text style={action}>＋ Dodaj</Text></Pressable>
        </View>
        {document.recurringBills.length === 0 ? <View style={ui.emptyState}><Text style={{ color: theme.colors.textSecondary }}>Brak pozostałych rachunków. Dodaj rachunki, aby mieć zapisane terminy i dane płatności.</Text></View> : document.recurringBills.map((bill) => {
          const property = document.properties.find((item) => item.id === bill.propertyId);
          return <View key={bill.id} style={[ui.card, { padding: 14 }]}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{bill.name} · {property?.name ?? "Mieszkanie"}</Text>
            <Text style={muted}>{bill.variableAmount ? "Kwotę sprawdź na bieżąco" : bill.expectedAmount ? `${bill.expectedAmount} zł` : "Kwota do sprawdzenia"}{bill.dueDay ? ` · termin ${bill.dueDay}. dzień` : ""}</Text>
            <View style={{ flexDirection: "row", gap: 16 }}><Text accessibilityRole="button" onPress={() => openBillDetails(bill)} style={action}>Szczegóły płatności</Text><Text accessibilityRole="button" onPress={() => openBill(bill)} style={action}>Edytuj</Text><Text accessibilityRole="button" onPress={() => removeBill(bill)} style={{ ...action, color: theme.colors.danger }}>Usuń</Text></View>
          </View>;
        })}
        </> : null}
        {activeSection === "data" ? <View style={ui.card}><Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Dane są zapisane lokalnie na tym urządzeniu.</Text><Text style={muted}>Aplikacja nie ma obecnie funkcji eksportu ani przywracania kopii zapasowej. W przypadku problemów z odczytem dostępny jest ekran odzyskiwania danych.</Text></View> : null}
        </>}
      </ScrollView>
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View
            style={{
              padding: 18,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.divider,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: 19,
                fontWeight: "700",
              }}
            >
              {editing ? "Edytuj mieszkanie" : "Nowe mieszkanie"}
            </Text>
            <Text
              onPress={() => {
                setModalOpen(false);
                setEditing(null);
                setSetupFocus(null);
              }}
              accessibilityRole="button"
              style={action}
            >
              Zamknij
            </Text>
          </View>
          <ScrollView
            ref={propertyEditorScrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20 }}
          >
            {field("Nazwa mieszkania *", "name", {
              placeholder: "np. Mieszkanie przy Parkowej",
            })}
            {field("Adres", "address")}
            {field("Domyślny czynsz miesięczny (zł)", "defaultMonthlyRent", {
              keyboardType: "decimal-pad",
              placeholder: "np. 2500,00",
            })}
            {field("Imię i nazwisko najemcy", "tenantName")}
            {field("Telefon", "tenantPhone", { keyboardType: "phone-pad" })}
            {field("E-mail", "tenantEmail", { keyboardType: "email-address" })}
            {field("Umowa najmu do (RRRR-MM-DD)", "rentalEndDate", { placeholder: "2026-12-31" })}
            <Text style={fieldLabel}>Przypomnij przed końcem umowy</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {AGREEMENT_REMINDER_DAYS.map((days) => {
                const selected = draft.rentalEndReminderDays.includes(days);
                return <Pressable key={days} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setDraft((current) => ({ ...current, rentalEndReminderDays: selected ? current.rentalEndReminderDays.filter((item) => item !== days) : [...current.rentalEndReminderDays, days].sort((a, b) => b - a) }))} style={[modeButton, selected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentSoft }]}><Text style={modeText}>{days === 0 ? "W dniu umowy" : `${days} dni`}</Text></Pressable>;
              })}
            </View>
            <Text style={sectionTitle}>Przypomnienie o czynszu</Text>
            <View onLayout={setupFocus === "payment-day" ? (event) => {
              propertyEditorScrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
              setSetupFocus(null);
            } : undefined}>
              <Text style={fieldLabel}>Oczekiwany dzień płatności (1–31)</Text><TextInput accessibilityLabel="Oczekiwany dzień płatności" value={draft.expectedPaymentDay} onChangeText={(value) => setDraft((current) => ({ ...current, expectedPaymentDay: value }))} keyboardType="number-pad" placeholder="np. 10" style={inputStyle} />
            </View>
            <View onLayout={setupFocus === "payment-reminder" ? (event) => {
              propertyEditorScrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
              setSetupFocus(null);
            } : undefined}>
              <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Przypominaj, aby sprawdzić wpłatę</Text><Switch value={draft.paymentReminderEnabled} onValueChange={(paymentReminderEnabled) => setDraft((current) => ({ ...current, paymentReminderEnabled }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accent }} thumbColor={theme.colors.surface} accessibilityLabel="Przypominaj o czynszu" accessibilityState={{ checked: draft.paymentReminderEnabled }} /></View>
            </View>
            {draft.paymentReminderEnabled ? <><Text style={fieldLabel}>Dni po oczekiwanym terminie (0–30)</Text><TextInput accessibilityLabel="Dni po oczekiwanym terminie" value={draft.paymentReminderDelayDays} onChangeText={(value) => setDraft((current) => ({ ...current, paymentReminderDelayDays: value }))} keyboardType="number-pad" placeholder="1" style={inputStyle} /></> : null}
            <Text style={sectionTitle}>Administracja</Text>
            {field("Nazwa administratora", "administratorName")}
            {field("Adres panelu administracji (HTTPS)", "administratorPortalUrl", { placeholder: "https://" })}
            {field("Telefon administracji", "administratorPhone", { keyboardType: "phone-pad" })}
            {field("E-mail administracji", "administratorEmail", { keyboardType: "email-address" })}
            <Text style={sectionTitle}>Przydatne linki</Text>
            <Text style={muted}>Linki otwierają się w przeglądarce. Nie zapisuj tu haseł.</Text>
            <TextInput accessibilityLabel="Nazwa przydatnego linku" value={linkLabel} onChangeText={setLinkLabel} placeholder="np. Dostawca prądu" style={inputStyle} />
            <TextInput accessibilityLabel="Adres przydatnego linku HTTPS" value={linkUrl} onChangeText={setLinkUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" style={inputStyle} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>{([ ["ADMINISTRATION", "Administracja"], ["UTILITY", "Media"], ["TAX", "Podatki"], ["OTHER", "Inne"] ] as const).map(([category, label]) => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ checked: linkCategory === category }} onPress={() => setLinkCategory(category)} style={[modeButton, linkCategory === category && { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentSoft }]}><Text style={modeText}>{label}</Text></Pressable>)}</View>
            <Pressable accessibilityRole="button" onPress={addPropertyLink} style={secondaryButton}><Text style={modeText}>Dodaj link</Text></Pressable>
            {linkDrafts.map((link) => <View key={link.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}><View style={{ flex: 1 }}><Text style={fieldLabel}>{link.label}</Text><Text style={muted}>{link.url}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Usuń link ${link.label}`} onPress={() => setLinkDrafts((current) => current.filter((item) => item.id !== link.id))}><Text style={{ ...action, color: theme.colors.danger }}>Usuń</Text></Pressable></View>)}
            {field("Notatki", "notes", { multiline: true })}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save()}
              style={[primaryButton, saving && { opacity: 0.6 }]}
            >
              <Text style={primaryText}>
                {saving ? "Zapisywanie…" : "Zapisz mieszkanie"}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={billModalOpen} animationType="slide" onRequestClose={() => setBillModalOpen(false)}>
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
            <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Kwota zmienna, sprawdzaj ją na bieżąco</Text><Switch value={billDraft.variableAmount} onValueChange={(variableAmount) => setBillDraft((current) => ({ ...current, variableAmount }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accent }} thumbColor={theme.colors.surface} accessibilityLabel="Kwota zmienna" accessibilityState={{ checked: billDraft.variableAmount }} /></View>
            <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Przypominaj o rachunku</Text><Switch value={billDraft.reminderEnabled} onValueChange={(reminderEnabled) => setBillDraft((current) => ({ ...current, reminderEnabled }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.accent }} thumbColor={theme.colors.surface} accessibilityLabel="Przypominaj o rachunku" accessibilityState={{ checked: billDraft.reminderEnabled }} /></View>
            <Pressable accessibilityRole="button" onPress={() => void saveBill()} style={primaryButton}><Text style={primaryText}>Zapisz rachunek</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal visible={Boolean(billForDetails)} animationType="slide" onRequestClose={() => setBillForDetails(null)}>
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={modalHeader}><Text style={modalTitle}>{billForDetails?.name ?? "Szczegóły płatności"}</Text><Text accessibilityRole="button" onPress={() => setBillForDetails(null)} style={action}>Zamknij</Text></View>
          {billForDetails ? <ScrollView contentContainerStyle={{ padding: 20 }}>
            {(() => {
              const property = document.properties.find((item) => item.id === billForDetails.propertyId);
              const details = { recipientName: billForDetails.recipientName, bankAccount: billForDetails.bankAccount, amount: billForDetails.variableAmount ? undefined : billForDetails.expectedAmount, title: billForDetails.paymentTitle, propertyName: property?.name };
              const dueDate = billForDetails.dueDay ? nextBillDueDate(billForDetails.dueDay) : undefined;
              const missing = missingPaymentDetails(details);
              return <>
                <Text accessibilityLabel="Okres rozliczeniowy płatności" style={{ ...muted, marginBottom: 10 }}>Okres rozliczenia: {billPaymentPeriod}</Text>
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
        </SafeAreaView>
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
const modeButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 };
const modeText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const sectionTitle = ui.sectionTitle;
const categoryRow = { minHeight: 72, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 14, paddingHorizontal: 14, marginBottom: 9 };
const categoryLabel = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 15 };
const settingsBack = { minHeight: 40, justifyContent: "center" as const, marginBottom: 6 };
const notificationRow = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const secondaryButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, minHeight: 44, borderRadius: 13, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 14, marginVertical: 8, backgroundColor: theme.colors.surface };
const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 6 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
const modalHeader = { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const };
const modalTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const };
