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
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PaymentDetail } from "../components/PaymentDetail";
import { PeriodSelector } from "../components/PeriodSelector";
import { SafeAreaView } from "react-native-safe-area-context";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import { createId, todayIsoDate, useRentalData } from "../data/RentalDataProvider";
import type { Property, RecurringBill, RentalDocument } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { isNonnegativeMoney, isPositiveMoney, isRentalMonth, isValidCalendarDate, isValidHttpsUrl, isValidPolishBankAccount, isValidTaxMicroAccount } from "../domain/rentalValidation";
import { hasTaxRulesForYear } from "../domain/ryczaltTax";
import { missingPaymentDetails } from "../domain/paymentDetails";
import { useReminders } from "../notifications/ReminderProvider";
import { deriveTasks } from "../domain/tasks";
import type { SetupAction } from "../domain/setupProgress";
import { setupActionField } from "../navigation/setupIntent";
import { makeBillPayment } from "../domain/billPayment";
import { settingsSections } from "../domain/rentalPresentation";
import { formatPolishCount, formatPolishDate } from "../domain/presentationFormat";
import { formatPlnAmount } from "../domain/ryczaltTax";
import { ELECTRICITY_PROVIDER_PRESETS, mergeAdministrationSuggestions, newApartmentDefaults } from "../domain/apartmentSetup";
import { effectiveLifecycle, setApartmentLifecycle } from "../domain/apartmentLifecycle";
import { bootstrapHistoricalRentPayments, historicalBootstrapDefaultRange, historicalTaxPaymentsForImportedRent } from "../domain/historicalRentBootstrap";
import { tenantMonthlyTotalGrosz, decimalFromGrosz } from "../domain/apartmentPayments";
import { apartmentTermsForMonth } from "../domain/apartmentTerms";
import { SETTINGS_TAX_LEGAL_DEFAULT_OPEN, SETTINGS_TAX_RECIPIENT, settingsArchiveLabel, settingsBackupStatus, settingsBillsEmpty, settingsNotificationSwitchValue, settingsNotificationsUnavailable, settingsReminderHasMore, settingsReminderList } from "../domain/settingsPresentation";

type PropertyDraft = Omit<Property, "id" | "ownerRent" | "mediaAmount" | "paymentDay" | "address" | "leaseEndDate" | "administrationName" | "administrationUrl" | "electricityProvider" | "electricityUrl" | "tenantName" | "tenantPhone" | "tenantEmail" | "notes"> & {
  address: string; leaseEndDate: string; administrationName: string; administrationUrl: string;
  electricityProvider: string; electricityUrl: string; tenantName: string; tenantPhone: string; tenantEmail: string; notes: string;
  ownerRent: string;
  mediaAmount: string;
  paymentDay: string;
  termsEffectiveFrom: string;
};
type PropertyDraftTextKey = "address" | "ownerRent" | "mediaAmount" | "tenantName" | "tenantPhone" | "tenantEmail" | "rentalStartDate" | "leaseEndDate" | "paymentDay" | "administrationName" | "administrationUrl" | "electricityProvider" | "electricityUrl" | "notes";
const newPropertyDraft = (): PropertyDraft => ({
  ...newApartmentDefaults(),
  address: "",
  ownerRent: "",
  mediaAmount: "",
  mediaPaidByTenant: false,
  tenantName: "",
  tenantPhone: "",
  tenantEmail: "",
  paymentDay: "5",
  termsEffectiveFrom: todayIsoDate().slice(0, 7),
  administrationName: "",
  administrationUrl: "",
  electricityProvider: "",
  electricityUrl: "",
  notes: "",
});

type BillDraft = { propertyId: string; name: string; recipientName: string; bankAccount: string; paymentTitle: string; expectedAmount: string; dueDay: string; reminderEnabled: boolean; variableAmount: boolean };
const emptyBillDraft: BillDraft = { propertyId: "", name: "", recipientName: "", bankAccount: "", paymentTitle: "", expectedAmount: "", dueDay: "", reminderEnabled: false, variableAmount: false };

export function SettingsScreen() {
  const { document, error, update, resetLocalData, isDemoMode } = useRentalData();
  const { permission, requestPermission } = useReminders();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const propertyEditorScrollRef = useRef<ScrollView>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [setupFocus, setSetupFocus] = useState<SetupAction | null>(null);
  const [showAdvancedProperty, setShowAdvancedProperty] = useState(false);
  const [showArchivedProperties, setShowArchivedProperties] = useState(false);
  const [taxEligibilityOpen, setTaxEligibilityOpen] = useState(SETTINGS_TAX_LEGAL_DEFAULT_OPEN);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [bootstrapProperty, setBootstrapProperty] = useState<Property | null>(null);
  const [bootstrapRange, setBootstrapRange] = useState<{ startMonth: string; endMonth: string } | null>(null);
  const [bootstrapRangeOpen, setBootstrapRangeOpen] = useState(false);
  const [bootstrapTaxPaid, setBootstrapTaxPaid] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyDraft>(() => newPropertyDraft());
  const [saving, setSaving] = useState(false);
  const [clearingLocalData, setClearingLocalData] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof settingsSections)[number]["id"] | null>(null);
  const [billEditing, setBillEditing] = useState<RecurringBill | null>(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<BillDraft>(emptyBillDraft);
  const [billForDetails, setBillForDetails] = useState<RecurringBill | null>(null);
  const [billPaymentPeriod, setBillPaymentPeriod] = useState(() => todayIsoDate().slice(0, 7));
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [taxAccount, setTaxAccount] = useState("");
  const [openingRevenueDraft, setOpeningRevenueDraft] = useState("");
  const [openingTaxPaidDraft, setOpeningTaxPaidDraft] = useState("");
  const reminderPlan = useMemo(() => document ? deriveTasks(document).filter((task) => task.status === "upcoming" || task.status === "needs-attention" || task.status === "snoozed") : [], [document]);
  const hasAnyTaxSnapshots = Boolean(document?.taxSettlementSnapshots?.length);

  useEffect(() => navigation.addListener("blur", () => setActiveSection(null)), [navigation]);

  useEffect(() => {
    if (!document) return;
    setTaxAccount((document.settings.taxMicroAccount ?? "").replace(/^PL/i, "").replace(/\D/g, ""));
    setOpeningRevenueDraft(document.settings.openingTaxableRevenue ?? "");
    setOpeningTaxPaidDraft(document.settings.openingTaxPaid ?? "");
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
    setShowAdvancedProperty(false);
    setModalOpen(true);
    const currentTerms = property ? apartmentTermsForMonth(property, todayIsoDate().slice(0, 7)) : null;
    setDraft(
      property
        ? {
            address: property.address,
            ownerRent: currentTerms ? decimalFromGrosz(currentTerms.ownerRentGrosz) : property.ownerRent ?? "",
            mediaAmount: currentTerms ? decimalFromGrosz(currentTerms.mediaAmountGrosz) : property.mediaAmount ?? "0",
            mediaPaidByTenant: currentTerms?.mediaPaidByTenant ?? property.mediaPaidByTenant ?? false,
            taxableTreatment: currentTerms?.taxableTreatment ?? property.taxableTreatment,
            tenantName: property.tenantName ?? "",
            tenantPhone: property.tenantPhone ?? "",
            tenantEmail: property.tenantEmail ?? "",
            rentalStartDate: property.rentalStartDate ?? "",
            leaseEndDate: property.leaseEndDate ?? "",
            paymentDay: (currentTerms?.paymentDay ?? property.paymentDay)?.toString() ?? "",
            termsEffectiveFrom: todayIsoDate().slice(0, 7),
            administrationName: property.administrationName ?? "",
            administrationUrl: property.administrationUrl ?? "",
            electricityProvider: property.electricityProvider ?? "",
            electricityUrl: property.electricityUrl ?? "",
            notes: property.notes ?? "",
          }
        : newPropertyDraft(),
    );
  };
  const openNewApartmentFromArchived = (property: Property) => {
    setEditing(null);
    setSetupFocus(null);
    setShowAdvancedProperty(false);
    setModalOpen(true);
    setDraft({
      ...newPropertyDraft(),
      address: property.address,
      ownerRent: property.ownerRent ?? "",
      rentSchedule: undefined,
      mediaAmount: property.mediaAmount ?? "0",
      mediaPaidByTenant: property.mediaPaidByTenant ?? false,
      taxableTreatment: property.taxableTreatment,
      tenantName: "", tenantPhone: "", tenantEmail: "",
      rentalStartDate: "", leaseEndDate: "", notes: "",
      administrationName: property.administrationName ?? "",
      administrationUrl: property.administrationUrl ?? "",
      electricityProvider: property.electricityProvider ?? "",
      electricityUrl: property.electricityUrl ?? "",
    });
  };
  const save = async () => {
    const address = draft.address.trim();
    const ownerRent = draft.ownerRent.trim().replace(",", ".");
    const mediaAmount = draft.mediaAmount.trim().replace(",", ".") || "0";
    if (!address) {
      Alert.alert("Brak adresu", "Wpisz adres mieszkania.");
      return;
    }
    if (!editing && !ownerRent) {
      Alert.alert("Brak czynszu właściciela", "Wpisz miesięczną kwotę czynszu dla właściciela.");
      return;
    }
    const normalizedAddress = address.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl-PL");
    if (document.properties.some((item) => item.id !== editing?.id && effectiveLifecycle(item) !== "ARCHIVED" && item.address.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl-PL") === normalizedAddress)) {
      Alert.alert("Mieszkanie już istnieje", "Aktywne mieszkanie o tym adresie już istnieje. Otwórz jego wpis, aby go edytować.");
      return;
    }
    if (ownerRent && !isNonnegativeMoney(ownerRent)) {
      Alert.alert("Nieprawidłowy czynsz", "Wpisz kwotę, np. 2500 lub 2500,50.");
      return;
    }
    if (!isNonnegativeMoney(mediaAmount)) {
      Alert.alert("Nieprawidłowa kwota mediów", "Wpisz kwotę, np. 350 lub 350,50.");
      return;
    }
    if (draft.taxableTreatment !== "OWNER_RENT" && draft.taxableTreatment !== "RENT_AND_CHARGES") {
      Alert.alert("Wybierz przychód do opodatkowania", "Wybierz sposób zgodny z warunkami umowy najmu przed zapisaniem mieszkania.");
      return;
    }
    const endDate = draft.leaseEndDate.trim();
    if (endDate && !isValidCalendarDate(endDate)) {
      Alert.alert("Nieprawidłowa data", "Sprawdź datę wygaśnięcia umowy.");
      return;
    }
    const startDate = draft.rentalStartDate?.trim() ?? "";
    if (startDate && !isValidCalendarDate(startDate)) {
      Alert.alert("Nieprawidłowa data", "Sprawdź datę rozpoczęcia najmu.");
      return;
    }
    const paymentDay = draft.paymentDay.trim() ? Number(draft.paymentDay) : undefined;
    if (paymentDay !== undefined && (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)) {
      Alert.alert("Nieprawidłowy termin", "Termin czynszu musi być dniem od 1 do 31.");
      return;
    }
    const effectiveFrom = draft.termsEffectiveFrom.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
      Alert.alert("Nieprawidłowy miesiąc", "Podaj miesiąc obowiązywania warunków w formacie RRRR-MM.");
      return;
    }
    const currentMonth = todayIsoDate().slice(0, 7);
    if (editing && effectiveFrom < currentMonth) {
      Alert.alert("Nie można zmienić zamkniętej historii", "Zmiana warunków mieszkania może obowiązywać od bieżącego miesiąca lub później. Korekty przeszłych okresów dodamy osobno.");
      return;
    }
    const administrationName = draft.administrationName.trim();
    const administrationUrl = draft.administrationUrl.trim();
    const electricityProvider = draft.electricityProvider.trim();
    const electricityUrl = draft.electricityUrl.trim();
    if (administrationUrl && !isValidHttpsUrl(administrationUrl)) {
      Alert.alert("Nieprawidłowy adres", "Adres panelu administracji musi używać HTTPS.");
      return;
    }
    if (electricityUrl && !isValidHttpsUrl(electricityUrl)) {
      Alert.alert("Nieprawidłowy adres", "Adres dostawcy prądu musi używać HTTPS.");
      return;
    }
    const rentSchedule = ownerRent ? updatedRentSchedule(editing, {
      effectiveFrom: !editing && startDate ? startDate.slice(0, 7) : effectiveFrom,
      amount: ownerRent, mediaAmount, mediaPaidByTenant: draft.mediaPaidByTenant,
      taxableTreatment: draft.taxableTreatment, paymentDay: paymentDay ?? 5,
    }) : editing?.rentSchedule;
    const effectiveNow = effectiveFrom <= currentMonth;
    const property: Property = {
      id: editing?.id ?? createId("property"),
      address,
      ...(ownerRent ? { ownerRent: effectiveNow || !editing ? ownerRent : editing.ownerRent } : {}),
      ...(rentSchedule ? { rentSchedule } : {}),
      lifecycle: editing ? effectiveLifecycle(editing) : "ACTIVE",
      ...(draft.rentalStartDate ? { rentalStartDate: draft.rentalStartDate } : editing?.rentalStartDate ? { rentalStartDate: editing.rentalStartDate } : {}),
      mediaAmount: effectiveNow || !editing ? mediaAmount : editing.mediaAmount,
      mediaPaidByTenant: effectiveNow || !editing ? draft.mediaPaidByTenant : editing.mediaPaidByTenant,
      taxableTreatment: effectiveNow || !editing ? draft.taxableTreatment : editing.taxableTreatment,
      ...optional("tenantName", draft.tenantName),
      ...optional("tenantPhone", draft.tenantPhone),
      ...optional("tenantEmail", draft.tenantEmail),
      ...(endDate ? { leaseEndDate: endDate } : {}),
      ...(paymentDay ? { paymentDay: effectiveNow || !editing ? paymentDay : editing.paymentDay } : {}),
      ...optional("administrationName", administrationName),
      ...optional("administrationUrl", administrationUrl),
      ...optional("electricityProvider", electricityProvider),
      ...optional("electricityUrl", electricityUrl),
      ...optional("notes", draft.notes),
    };
    setSaving(true);
    try {
      await update((current) => ({
        ...current,
        administrationSuggestions: administrationName
          ? mergeAdministrationSuggestions(current.administrationSuggestions, { name: administrationName, ...(administrationUrl ? { url: administrationUrl } : {}) })
          : current.administrationSuggestions,
        properties: editing
          ? current.properties.map((item) =>
              item.id === editing.id ? property : item,
            )
          : [...current.properties, property],
      }));
      if (!editing) {
        const today = todayIsoDate();
        const range = historicalBootstrapDefaultRange(today, draft.rentalStartDate || undefined);
        if (range.endMonth && range.startMonth <= range.endMonth && ownerRent) {
          setBootstrapProperty(property);
          setBootstrapRange({ startMonth: range.startMonth, endMonth: range.endMonth });
          setBootstrapTaxPaid(true);
        }
      }
      setEditing(null);
      setSetupFocus(null);
      setModalOpen(false);
    } catch {
      /* The provider reports the save failure. */
    } finally {
      setSaving(false);
    }
  };
  const changeLifecycle = (property: Property, lifecycle: "ACTIVE" | "PAUSED" | "ARCHIVED") => {
    const apply = () => void update((current) => setApartmentLifecycle(current, property.id, lifecycle)).then(() => {
      const next = { ...property, lifecycle };
      if (editing?.id === property.id) setEditing(next);
    }).catch(() => undefined);
    if (effectiveLifecycle(property) === "ARCHIVED") return;
    if (lifecycle === "ACTIVE") apply();
    else Alert.alert(lifecycle === "PAUSED" ? "Wstrzymać najem?" : "Zarchiwizować mieszkanie?",
      lifecycle === "PAUSED" ? "Wstrzymanie zatrzymuje oczekiwania czynszu i przypomnienia od bieżącego miesiąca. Historię zachowasz bez zmian." : "Archiwizacja jest trwała. Historia i wpłaty pozostaną dostępne, ale tego wpisu nie będzie można wznowić. W razie nowego najmu utwórz nowy wpis.",
      [{ text: "Anuluj", style: "cancel" }, { text: lifecycle === "PAUSED" ? "Wstrzymaj" : "Archiwizuj", style: lifecycle === "ARCHIVED" ? "destructive" : "default", onPress: apply }]);
  };
  const setRentReminderDelay = (days: number) => update((current) => ({ ...current, settings: { ...current.settings, rentReminderDelayDays: days } })).catch(() => undefined);
  const confirmHistoricalBootstrap = async () => {
    if (!bootstrapProperty || !bootstrapRange) return;
    const today = todayIsoDate();
    setSaving(true);
    try {
      let created = 0;
      await update((current) => {
        const result = bootstrapHistoricalRentPayments({ document: current, property: bootstrapProperty, ...bootstrapRange, today });
        created = result.created.length;
        const historicalTaxPayments = historicalTaxPaymentsForImportedRent(result.document, result.created, bootstrapTaxPaid);
        const replacedPaymentIds = new Set(historicalTaxPayments.map((payment) => payment.id));
        return { ...result.document, taxPayments: [...result.document.taxPayments.filter((payment) => !replacedPaymentIds.has(payment.id)), ...historicalTaxPayments] };
      });
      setBootstrapProperty(null);
      setBootstrapRange(null);
      Alert.alert("Wpłaty początkowe", created ? `Dodano ${created} potwierdzonych wpłat. Możesz je później poprawić w historii.` : "W wybranym okresie nie dodano wpłat — istniejące miesiące zostały pominięte.");
    } catch { /* The provider reports persistence errors. */ }
    finally { setSaving(false); }
  };
  const field = (
    label: string,
    key: PropertyDraftTextKey,
    options: {
      keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad" | "number-pad" | "url";
      multiline?: boolean;
      placeholder?: string;
      selectTextOnFocus?: boolean;
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
        autoCapitalize={key.endsWith("Url") ? "none" : undefined}
        multiline={options.multiline}
        selectTextOnFocus={options.selectTextOnFocus}
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
  const saveOpeningBalances = () => {
    if (document?.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)) {
      Alert.alert("Rok ma zamknięte okresy", "Stan początkowy jest częścią zapisanych rozliczeń. Nie można go zmienić po zamknięciu miesiąca."); return;
    }
    const revenue = openingRevenueDraft.trim().replace(",", ".");
    const paid = openingTaxPaidDraft.trim().replace(",", ".");
    if ((revenue && !isNonnegativeMoney(revenue)) || (paid && !isNonnegativeMoney(paid))) {
      Alert.alert("Nieprawidłowa kwota", "Wpisz kwoty równe lub większe od zera."); return;
    }
    updateTaxSettings((settings) => ({ ...settings, openingTaxableRevenue: revenue || undefined, openingTaxPaid: paid || undefined }));
  };
  const saveTaxPaymentSettings = async () => {
    const account = taxAccount.replace(/\D/g, "");
    if (!isValidTaxMicroAccount(account)) {
      Alert.alert("Nieprawidłowy rachunek", "Wpisz prawidłowy 26-cyfrowy polski mikrorachunek podatkowy.");
      return;
    }
    try {
      await update((current) => ({ ...current, settings: { ...current.settings, taxRecipientName: SETTINGS_TAX_RECIPIENT, taxMicroAccount: account } }));
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
  const archivedProperties = document.properties.filter((property) => effectiveLifecycle(property) === "ARCHIVED");
  const taxAccountValid = isValidTaxMicroAccount(taxAccount);
  const taxAccountError = taxAccount && !taxAccountValid
    ? taxAccount.length < 26 ? "Wpisz dokładnie 26 cyfr." : "Sprawdź poprawność numeru mikrorachunku."
    : null;
  const confirmClearLocalData = () => Alert.alert(
    "Usunąć wszystkie dane?",
    "Ta operacja bezpowrotnie usunie z tego urządzenia mieszkania, wpłaty, rozliczenia podatku, rachunki, przypomnienia i ustawienia. Usunięta zostanie też lokalna kopia odzyskiwania. Nie można tego cofnąć.",
    [
      { text: "Anuluj", style: "cancel" },
      { text: "Usuń dane", style: "destructive", onPress: () => {
        setClearingLocalData(true);
        void resetLocalData().then(() => {
          setActiveSection(null);
          Alert.alert("Dane usunięte", "Wszystkie zapisane dane lokalne zostały usunięte.");
        }).catch(() => {
          Alert.alert("Nie udało się usunąć danych", "Część danych mogła pozostać na urządzeniu. Spróbuj ponownie.");
        }).finally(() => setClearingLocalData(false));
      } },
    ],
  );

  return (
      <View style={ui.page}>
      <ScrollView contentContainerStyle={{ ...ui.content, paddingBottom: 40 }}>
        {activeSection === null ? <>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700", marginBottom: 12 }}>Ustawienia</Text>
        {settingsSections.map((section) => {
          const summary = section.id === "properties" ? formatPolishCount(document.properties.length, ["mieszkanie", "mieszkania", "mieszkań"])
            : section.id === "tax" ? `Ryczałt · ${document.settings.settlementMode === "monthly" ? "miesięcznie" : "kwartalnie"} · próg stawki 12,5%: ${document.settings.jointSpouseThreshold ? "200 000" : "100 000"} zł`
              : section.id === "payment" ? (document.settings.taxRecipientName && document.settings.taxMicroAccount ? "Dane zapisane" : "Dane wymagają uzupełnienia")
                : section.id === "notifications" ? `${formatPolishCount(Object.values(document.settings.reminderCategories).filter(Boolean).length, ["kategoria", "kategorie", "kategorii"])}${permission === "granted" ? " · lokalne ON" : ""}`
                : section.id === "bills" ? formatPolishCount(document.recurringBills.length, ["rachunek", "rachunki", "rachunków"]) : "Dane lokalne na tym urządzeniu";
          return <Pressable key={section.id} accessibilityRole="button" accessibilityLabel={`${section.label}. ${summary}`} accessibilityHint="Otwiera ustawienia tej kategorii" onPress={() => setActiveSection(section.id)} style={categoryRow}>
            <View style={{ flex: 1 }}><Text style={categoryLabel}>{section.label}</Text><Text style={muted}>{summary}</Text></View><Text style={action}>›</Text>
          </Pressable>;
        })}
        </> : <>
        <Pressable accessibilityRole="button" onPress={() => setActiveSection(null)} style={settingsBack}><Text style={action}>‹ Ustawienia</Text></Pressable>
        <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 12 }}>{settingsSections.find((section) => section.id === activeSection)?.label}</Text>
        {activeSection === "tax" ? <>
        <PeriodSelector value={String(document.settings.taxYear)} valueLabel={`Rok podatkowy ${document.settings.taxYear}`} previousLabel="Poprzedni rok podatkowy" nextLabel="Następny rok podatkowy"
          previousDisabled={document.settings.taxYear <= 2025} nextDisabled={document.settings.taxYear >= new Date().getFullYear()}
          onPrevious={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear - 1 }))}
          onNext={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear + 1 }))} />
        {!hasTaxRulesForYear(document.settings.taxYear) ? <Text accessibilityRole="alert" style={{ color: theme.colors.warning, marginTop: 8 }}>Możesz wybrać ten rok kalendarzowy, ale reguły podatkowe nie są jeszcze zweryfikowane i wyliczenie pozostanie niedostępne.</Text> : null}
        <Text style={sectionTitle}>Rozliczenie</Text>
        <View style={[ui.card, { padding: 14, marginVertical: 10 }]}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Rozliczenie miesięczne</Text>
          <Text style={muted}>Nowe ustawienia konta korzystają z miesięcznych okresów podatkowych.</Text>
        </View>
        <View style={notificationRow}><Text style={{ ...rowTitle, flex: 1 }}>Limit 200 000 zł dla małżonków</Text><Switch disabled={hasAnyTaxSnapshots} value={document.settings.jointSpouseThreshold} onValueChange={(enabled) => {
          if (!enabled) { updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: false })); return; }
          Alert.alert("Limit dla małżonków", "Wyższy limit 200 000 zł stosuj wyłącznie, jeśli spełniasz warunki wspólności majątkowej i opodatkowania całości przychodów przez jednego małżonka.", [
            { text: "Anuluj", style: "cancel" }, { text: "Potwierdzam", onPress: () => updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: true })) },
          ]);
        }} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel="Limit 200 000 zł dla małżonków" accessibilityState={{ checked: document.settings.jointSpouseThreshold, disabled: hasAnyTaxSnapshots }} /></View>
        {hasAnyTaxSnapshots ? <Text style={muted}>Limit progu jest zablokowany po zapisaniu rozliczeń, aby nie zmienić pozostałych okresów roku.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: taxEligibilityOpen }} onPress={() => setTaxEligibilityOpen((open) => !open)} style={disclosureRow}><Text style={disclosureTitle}>ⓘ Kiedy mogę użyć tego limitu? {taxEligibilityOpen ? "⌃" : "›"}</Text></Pressable>
        {taxEligibilityOpen ? <Text style={legalText}>Wyższy limit 200 000 zł stosuj wyłącznie przy wspólności majątkowej i wyborze opodatkowania całości przychodów z najmu przez jednego małżonka, po złożeniu wymaganego oświadczenia w terminie.</Text> : null}
        <Text style={[sectionTitle, { marginTop: 18 }]}>Stan początkowy {document.settings.taxYear}</Text>
        <Text style={muted}>Wpisz łączny przychód i podatek sprzed rozpoczęcia śledzenia w tym roku. Kwoty wpływają na roczny próg i pokazują zbiorczy stan, bez przypisywania różnicy do nieznanego miesiąca.</Text>
        <Text style={fieldLabel}>Przychód otrzymany wcześniej w tym roku</Text>
        <TextInput editable={!document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} accessibilityLabel="Przychód otrzymany wcześniej w tym roku" keyboardType="decimal-pad" value={openingRevenueDraft} onChangeText={setOpeningRevenueDraft} placeholder="0" placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
        <Text style={fieldLabel}>Podatek zapłacony wcześniej w tym roku</Text>
        <TextInput editable={!document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} accessibilityLabel="Podatek zapłacony wcześniej w tym roku" keyboardType="decimal-pad" value={openingTaxPaidDraft} onChangeText={setOpeningTaxPaidDraft} placeholder="0" placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
        <Pressable accessibilityRole="button" disabled={document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} onPress={saveOpeningBalances} style={[secondaryButton, document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear) && disabledControl]}><Text style={modeText}>Zapisz stan początkowy</Text></Pressable>
        </> : null}
        {activeSection === "notifications" ? <>
        {settingsNotificationsUnavailable(permission)
          ? <View accessibilityRole="summary" style={neutralBanner}><Text style={muted}>Powiadomienia lokalne są dostępne w aplikacji mobilnej.</Text></View>
          : <Text style={muted}>{permission === "granted" ? "Powiadomienia systemowe są włączone." : permission === "denied" ? "Brak zgody systemowej. Przypomnienia są nadal widoczne w aplikacji." : "Włącz zgodę systemową, aby otrzymywać przypomnienia poza aplikacją."}</Text>}
        {permission !== "granted" && permission !== "unavailable" ? <Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={secondaryButton}><Text style={modeText}>Włącz powiadomienia</Text></Pressable> : null}
        <Text style={sectionTitle}>Kiedy przypominać</Text>
        <Text style={fieldLabel}>Przypomnij o nieopłaconym czynszu</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{[0, 1, 3, 7].map((days) => <Pressable key={days} accessibilityRole="radio" accessibilityState={{ checked: document.settings.rentReminderDelayDays === days, disabled: settingsNotificationsUnavailable(permission) }} disabled={settingsNotificationsUnavailable(permission)} onPress={() => setRentReminderDelay(days)} style={[modeButton, document.settings.rentReminderDelayDays === days && { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.selectedSurface }, settingsNotificationsUnavailable(permission) && disabledControl]}><Text style={modeText}>{days === 0 ? "W terminie" : `${days} ${days === 1 ? "dzień" : "dni"} po`}</Text></Pressable>)}</View>
        <Text style={sectionTitle}>Kategorie</Text>
        {([
          ["rent", "Wpłaty czynszu"], ["agreements", "Kończące się umowy"], ["tax", "Podatek"], ["bills", "Rachunki cykliczne"], ["custom", "Przypomnienia osobiste"],
        ] as const).map(([category, label]) => <View key={category} style={[notificationRow, settingsNotificationsUnavailable(permission) && disabledControl]}><Text style={{ ...rowTitle, flex: 1 }}>{label}</Text><Switch disabled={settingsNotificationsUnavailable(permission)} value={settingsNotificationSwitchValue(document.settings.reminderCategories[category], permission)} onValueChange={() => toggleReminderCategory(category)} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel={label} accessibilityState={{ checked: settingsNotificationSwitchValue(document.settings.reminderCategories[category], permission), disabled: settingsNotificationsUnavailable(permission) }} /></View>)}
        <Text style={fieldLabel}>Najbliższe przypomnienia</Text>
        {reminderPlan.length ? settingsReminderList(reminderPlan, showAllReminders).map((task) => <Text key={task.id} style={muted}>{formatPolishDate(task.dueAt)} · {task.title}</Text>) : <Text style={muted}>Brak nadchodzących przypomnień.</Text>}
        {settingsReminderHasMore(reminderPlan, showAllReminders) ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAllReminders }} onPress={() => setShowAllReminders(true)} style={{ paddingVertical: 10 }}><Text style={action}>Pokaż wszystkie</Text></Pressable> : null}
        </> : null}
        {activeSection === "payment" ? <>
        <Text style={muted}>Wpisz własny numer mikrorachunku. Aplikacja nie tworzy numeru rachunku ani przelewu.</Text>
        <Text style={fieldLabel}>Odbiorca</Text><Text style={staticPaymentValue}>{SETTINGS_TAX_RECIPIENT}</Text>
        <Text style={fieldLabel}>Mikrorachunek podatkowy</Text><TextInput accessibilityLabel="Mikrorachunek podatkowy" value={taxAccount} onChangeText={(value) => setTaxAccount(value.replace(/\D/g, "").slice(0, 26))} keyboardType="number-pad" maxLength={26} placeholder="Wpisz 26 cyfr" style={[inputStyle, taxAccountError && invalidInput]} />
        <Text style={taxAccountError ? validationError : helperText}>{taxAccountError ?? `26 cyfr · ${taxAccount.length}/26`}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !taxAccountValid }} disabled={!taxAccountValid} onPress={() => void saveTaxPaymentSettings()} style={[secondaryButton, !taxAccountValid && disabledControl]}><Text style={modeText}>Zapisz dane płatności</Text></Pressable>
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
        {document.properties.filter((property) => effectiveLifecycle(property) !== "ARCHIVED").length === 0 ? (
          <View style={ui.emptyState}><Text style={{ color: theme.colors.textSecondary }}>Nie dodano jeszcze mieszkań.</Text></View>
        ) : (
          document.properties.filter((property) => effectiveLifecycle(property) !== "ARCHIVED").map((property) => (
          <Pressable
              key={property.id}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj ${property.address}${property.tenantName ? `, ${property.tenantName}` : ""}, ${formatPlnAmount(decimalFromGrosz(tenantMonthlyTotalGrosz(property)))} miesięcznie`}
              onPress={() => openProperty(property)}
              style={[ui.card, apartmentCard]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><View style={{ flex: 1 }}><Text style={apartmentTitle}>{property.address}</Text><Text style={apartmentTenant}>{property.tenantName || "Najemca nieuzupełniony"}</Text></View><Text style={action}>›</Text></View>
              <Text style={apartmentMeta}>{formatPlnAmount(decimalFromGrosz(tenantMonthlyTotalGrosz(property)))} / mies. · płatne do {property.paymentDay ?? 5}. dnia</Text>
              {effectiveLifecycle(property) !== "ACTIVE" ? <Text style={muted}>{effectiveLifecycle(property) === "PAUSED" ? "Najem wstrzymany" : "Zarchiwizowane"}</Text> : null}
            </Pressable>
          ))
        )}
        {settingsArchiveLabel(archivedProperties.length) ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showArchivedProperties }} onPress={() => setShowArchivedProperties((visible) => !visible)} style={{ paddingVertical: 12 }}><Text style={action}>{showArchivedProperties ? "Ukryj archiwum" : settingsArchiveLabel(archivedProperties.length)}</Text></Pressable> : null}
        {showArchivedProperties ? archivedProperties.map((property) => <View key={property.id} style={[ui.card, apartmentCard]}><Text style={apartmentTitle}>{property.address}</Text><Text style={muted}>{property.tenantName ?? "Najemca nieuzupełniony"} · Zarchiwizowane · historia zachowana</Text><Pressable accessibilityRole="button" accessibilityLabel={`Utwórz nowe mieszkanie na podstawie ${property.address}`} onPress={() => openNewApartmentFromArchived(property)} style={{ paddingVertical: 10 }}><Text style={action}>Utwórz nowy wpis z tych danych</Text></Pressable></View>) : null}
        </> : null}
        {activeSection === "bills" ? <>
        {settingsBillsEmpty(document.recurringBills.length) ? <View style={[ui.emptyState, billsEmptyState]}><Text style={emptyStateTitle}>Brak pozostałych rachunków</Text><Text style={muted}>Możesz dodać np. ubezpieczenie, czynsz administracyjny lub inny stały termin.</Text><Pressable accessibilityRole="button" onPress={() => openBill()} style={primaryButton}><Text style={primaryText}>＋ Dodaj rachunek</Text></Pressable></View> : <>
        <View style={{ marginTop: 4, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}><Pressable accessibilityRole="button" onPress={() => openBill()}><Text style={action}>＋ Dodaj</Text></Pressable></View>
        {document.recurringBills.map((bill) => {
          const property = document.properties.find((item) => item.id === bill.propertyId);
          return <View key={bill.id} style={[ui.card, { padding: 14 }]}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{bill.name} · {property?.address ?? "Mieszkanie"}</Text>
            <Text style={muted}>{bill.variableAmount ? "Kwotę sprawdź na bieżąco" : bill.expectedAmount ? formatPlnAmount(bill.expectedAmount) : "Kwota do sprawdzenia"}{bill.dueDay ? ` · termin ${bill.dueDay}. dzień` : ""}</Text>
            <View style={{ flexDirection: "row", gap: 16 }}><Text accessibilityRole="button" onPress={() => openBillDetails(bill)} style={action}>Szczegóły płatności</Text><Text accessibilityRole="button" onPress={() => openBill(bill)} style={action}>Edytuj</Text><Text accessibilityRole="button" onPress={() => removeBill(bill)} style={{ ...action, color: theme.colors.danger }}>Usuń</Text></View>
          </View>;
        })}
        </>}
        </> : null}
        {activeSection === "data" ? <View style={{ gap: 9, marginTop: 2 }}>
          <View style={[ui.card, trustCard]}><Text style={sectionTitle}>Dane lokalne</Text><Text style={muted}>{settingsBackupStatus.local}</Text><Text style={helperText}>{settingsBackupStatus.network}</Text></View>
          <View style={[ui.card, trustCard]}><Text style={sectionTitle}>Odzyskiwanie danych</Text><Text style={muted}>{settingsBackupStatus.capabilities}</Text><Text style={muted}>{settingsBackupStatus.uninstall}</Text><Text style={helperText}>W aplikacji działa lokalny mechanizm odzyskiwania po błędzie zapisu; nie zastępuje on kopii poza urządzeniem.</Text></View>
          {isDemoMode ? <Text style={helperText}>W trybie demo możesz wyjść z prezentacji, aby zarządzać zapisanymi danymi.</Text> : <View style={[ui.card, trustCard]}>
            <Text style={sectionTitle}>Usuwanie danych</Text>
            <Text style={muted}>Usuń wszystkie zapisane dane i kopię odzyskiwania z tego urządzenia.</Text>
            <Pressable accessibilityRole="button" disabled={clearingLocalData} onPress={confirmClearLocalData} style={[clearDataButton, clearingLocalData && { opacity: 0.6 }]}>
              <Text style={clearDataText}>{clearingLocalData ? "Usuwanie danych…" : "Usuń wszystkie dane"}</Text>
            </Pressable>
          </View>}
        </View> : null}
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
            <Text style={sectionTitle}>Mieszkanie</Text>
            {field("Adres *", "address", { placeholder: "np. ul. Parkowa 12/4" })}
            {field("Najemca", "tenantName", { placeholder: "Imię i nazwisko" })}
            <Text style={sectionTitle}>Płatności</Text>
            <Text style={fieldLabel}>Warunki obowiązują od miesiąca</Text>
            <TextInput accessibilityLabel="Warunki obowiązują od miesiąca" keyboardType="numbers-and-punctuation" value={draft.termsEffectiveFrom} onChangeText={(value) => setDraft((current) => ({ ...current, termsEffectiveFrom: value }))} placeholder="2026-10" placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
            <Text style={{ ...muted, marginBottom: 8 }}>Zmiany czynszu, mediów, podstawy podatku i terminu dotyczą tego miesiąca i kolejnych. Zamknięte miesiące pozostają bez zmian.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>{field("Czynsz dla właściciela (zł)", "ownerRent", { keyboardType: "decimal-pad", placeholder: "2500", selectTextOnFocus: true })}</View>
              <View style={{ flex: 1 }}>{field("Media / opłaty (zł/mies.)", "mediaAmount", { keyboardType: "decimal-pad", placeholder: "0", selectTextOnFocus: true })}</View>
            </View>
            <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Media płaci najemca</Text><Switch value={draft.mediaPaidByTenant} onValueChange={(mediaPaidByTenant) => setDraft((current) => ({ ...current, mediaPaidByTenant }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel="Media płaci najemca" accessibilityState={{ checked: draft.mediaPaidByTenant }} /></View>
            <Text style={sectionTitle}>Co wliczać do przychodu opodatkowanego?</Text>
            <Text style={muted}>Wybierz wariant zgodny z warunkami Twojej umowy najmu.</Text>
            {([["OWNER_RENT", "Tylko czynsz dla właściciela"], ["RENT_AND_CHARGES", "Czynsz i opłaty dodatkowe"]] as const).map(([value, label]) => {
              const selected = draft.taxableTreatment === value;
              return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setDraft((current) => ({ ...current, taxableTreatment: value }))} style={[taxableOption, selected && taxableOptionSelected]}>
                <Text style={[radioMark, selected && radioMarkSelected]}>{selected ? "●" : "○"}</Text>
                <Text style={[taxableOptionLabel, selected && taxableOptionLabelSelected]}>{label}</Text>
              </Pressable>;
            })}
            <Text style={{ ...muted, marginBottom: 8 }}>Razem od najemcy: {tenantDraftTotal(draft)} / mies.</Text>
            <View onLayout={setupFocus === "payment-day" ? (event) => { propertyEditorScrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true }); setSetupFocus(null); } : undefined}>
              {field("Termin płatności", "paymentDay", { keyboardType: "number-pad", placeholder: "5" })}
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAdvancedProperty }} onPress={() => setShowAdvancedProperty((value) => !value)} style={disclosureRow}><Text style={action}>{showAdvancedProperty ? "Mniej ustawień" : "Więcej ustawień"}</Text><Text style={disclosureChevron}>{showAdvancedProperty ? "⌃" : "⌄"}</Text></Pressable>
            {showAdvancedProperty ? <>
            <Text style={sectionTitle}>Daty najmu</Text>
            {field("Najem rozpoczął się", "rentalStartDate", { placeholder: "2026-01-01" })}
            {field("Umowa wygasa", "leaseEndDate", { placeholder: "2027-09-28" })}
            <Text style={sectionTitle}>Dane kontaktowe</Text>
            <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}>{field("Telefon", "tenantPhone", { keyboardType: "phone-pad" })}</View><View style={{ flex: 1 }}>{field("E-mail", "tenantEmail", { keyboardType: "email-address" })}</View></View>
            <Text style={sectionTitle}>Obsługa mieszkania</Text>
            {field("Administracja", "administrationName", { placeholder: "np. wspólnota / zarządca" })}
            {draft.administrationName.trim() ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>{document.administrationSuggestions.filter((suggestion) => suggestion.name.toLocaleLowerCase().includes(draft.administrationName.trim().toLocaleLowerCase())).map((suggestion) => <Pressable key={suggestion.name} accessibilityRole="button" onPress={() => setDraft((current) => ({ ...current, administrationName: suggestion.name, administrationUrl: suggestion.url ?? current.administrationUrl }))} style={modeButton}><Text style={modeText}>{suggestion.name}</Text></Pressable>)}</View> : null}
            {field("Adres panelu", "administrationUrl", { placeholder: "https://", keyboardType: "url" })}
            <Text style={fieldLabel}>Dostawca prądu</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>{[...ELECTRICITY_PROVIDER_PRESETS.map((preset) => preset.name), "Inny"].map((provider) => { const selected = provider === "Inny" ? !ELECTRICITY_PROVIDER_PRESETS.some((preset) => preset.name === draft.electricityProvider) : draft.electricityProvider === provider; return <Pressable key={provider} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { if (provider === "Inny") setDraft((current) => ({ ...current, electricityProvider: ELECTRICITY_PROVIDER_PRESETS.some((preset) => preset.name === current.electricityProvider) ? "" : current.electricityProvider })); else { const preset = ELECTRICITY_PROVIDER_PRESETS.find((item) => item.name === provider)!; setDraft((current) => ({ ...current, electricityProvider: preset.name, electricityUrl: preset.url })); } }} style={[modeButton, selected && { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.selectedSurface }]}><Text style={modeText}>{provider}</Text></Pressable>; })}</View>
            {field("Nazwa dostawcy", "electricityProvider", { placeholder: "np. lokalny dostawca" })}
            {field("URL dostawcy", "electricityUrl", { placeholder: "https://", keyboardType: "url" })}
            <Text style={sectionTitle}>Notatki</Text>
            {field("Notatki", "notes", { multiline: true })}
            </> : null}
            {editing ? <View style={{ marginTop: 6, marginBottom: 8 }}>
              <Text style={fieldLabel}>Status najmu</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {effectiveLifecycle(editing) !== "ARCHIVED" ? <Pressable accessibilityRole="button" onPress={() => changeLifecycle(editing, effectiveLifecycle(editing) === "PAUSED" ? "ACTIVE" : "PAUSED")} style={secondaryButton}><Text style={modeText}>{effectiveLifecycle(editing) === "PAUSED" ? "Wznów najem" : "Wstrzymaj najem"}</Text></Pressable> : null}
                {effectiveLifecycle(editing) !== "ARCHIVED" ? <Pressable accessibilityRole="button" onPress={() => changeLifecycle(editing, "ARCHIVED")} style={secondaryButton}><Text style={modeText}>Archiwizuj</Text></Pressable> : null}
              </View>
            </View> : null}
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
      <Modal visible={Boolean(bootstrapProperty && bootstrapRange)} animationType="slide" onRequestClose={() => { setBootstrapProperty(null); setBootstrapRange(null); }}>
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={modalHeader}><Text style={modalTitle}>Wpłaty początkowe</Text><Pressable accessibilityRole="button" onPress={() => { setBootstrapProperty(null); setBootstrapRange(null); }}><Text style={action}>Pomiń</Text></Pressable></View>
          {bootstrapProperty && bootstrapRange ? <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={muted}>Wstępnie uzupełnimy czynsz za zakończone miesiące. Sprawdź okres, potwierdź otrzymane wpłaty i zdecyduj, czy wyliczony za nie podatek został już zapłacony.</Text>
            <View style={[ui.card, { marginTop: 16 }]}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>{bootstrapProperty.address}</Text>
              <Text style={muted}>{bootstrapRange.startMonth} – {bootstrapRange.endMonth}</Text>
              <Text style={muted}>{formatPolishCount(bootstrapMonthCount(bootstrapRange.startMonth, bootstrapRange.endMonth), ["miesiąc", "miesiące", "miesięcy"])} · kwoty z warunków najmu obowiązujących w danym miesiącu</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: bootstrapRangeOpen }} onPress={() => setBootstrapRangeOpen((open) => !open)} style={{ paddingVertical: 12 }}><Text style={action}>{bootstrapRangeOpen ? "− Zmień okres" : "+ Zmień okres"}</Text></Pressable>
            {bootstrapRangeOpen ? <View style={{ gap: 12, marginBottom: 16 }}>
              {(["startMonth", "endMonth"] as const).map((key) => <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={muted}>{key === "startMonth" ? "Od" : "Do"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}><Pressable accessibilityRole="button" onPress={() => setBootstrapRange((range) => range ? shiftBootstrapRange(range, bootstrapProperty, key, -1) : range)}><Text style={action}>‹</Text></Pressable><Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{bootstrapRange[key]}</Text><Pressable accessibilityRole="button" onPress={() => setBootstrapRange((range) => range ? shiftBootstrapRange(range, bootstrapProperty, key, 1) : range)}><Text style={action}>›</Text></Pressable></View>
              </View>)}
            </View> : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: bootstrapTaxPaid }} onPress={() => setBootstrapTaxPaid((value) => !value)} style={[notificationRow, { marginVertical: 12 }]}>
              <View style={{ flex: 1 }}><Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>Podatek za te okresy został zapłacony</Text><Text style={muted}>Domyślnie zaznaczone. Zapiszemy wyliczoną kwotę z datą terminu oznaczoną jako szacunkowa. Gdy uzupełnisz kolejne mieszkanie za ten sam miesiąc, szacowana kwota uwzględni łączny przychód. Odznacz, jeśli podatek nie został zapłacony.</Text></View>
              <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{bootstrapTaxPaid ? "☑" : "□"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirmHistoricalBootstrap()} style={[primaryButton, saving && { opacity: 0.6 }]}><Text style={primaryText}>{saving ? "Zapisywanie…" : "Potwierdź otrzymane wpłaty"}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setBootstrapProperty(null); setBootstrapRange(null); }} style={secondaryButton}><Text style={modeText}>Pomiń ten krok</Text></Pressable>
          </ScrollView> : null}
        </SafeAreaView>
      </Modal>
      <Modal visible={billModalOpen} animationType="slide" onRequestClose={() => setBillModalOpen(false)}>
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={modalHeader}><Text style={modalTitle}>{billEditing ? "Edytuj rachunek" : "Nowy rachunek"}</Text><Text accessibilityRole="button" onPress={() => setBillModalOpen(false)} style={action}>Zamknij</Text></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <Text style={fieldLabel}>Mieszkanie</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{document.properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: billDraft.propertyId === property.id }} onPress={() => setBillDraft((current) => ({ ...current, propertyId: property.id }))} style={[modeButton, billDraft.propertyId === property.id && { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.selectedSurface }]}><Text style={modeText}>{property.address}</Text></Pressable>)}</View>
            {billFields("Nazwa rachunku", "name")}
            {billFields("Odbiorca", "recipientName")}
            {billFields("Polski numer rachunku", "bankAccount")}
            {billFields("Tytuł płatności", "paymentTitle")}
            {billFields("Oczekiwana kwota (zł)", "expectedAmount", "decimal-pad")}
            {billFields("Dzień terminu płatności (1–31)", "dueDay", "number-pad")}
            <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Kwota zmienna, sprawdzaj ją na bieżąco</Text><Switch value={billDraft.variableAmount} onValueChange={(variableAmount) => setBillDraft((current) => ({ ...current, variableAmount }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel="Kwota zmienna" accessibilityState={{ checked: billDraft.variableAmount }} /></View>
            <View style={notificationRow}><Text style={{ ...muted, flex: 1 }}>Przypominaj o rachunku</Text><Switch value={billDraft.reminderEnabled} onValueChange={(reminderEnabled) => setBillDraft((current) => ({ ...current, reminderEnabled }))} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel="Przypominaj o rachunku" accessibilityState={{ checked: billDraft.reminderEnabled }} /></View>
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
              const details = { recipientName: billForDetails.recipientName, bankAccount: billForDetails.bankAccount, amount: billForDetails.variableAmount ? undefined : billForDetails.expectedAmount, title: billForDetails.paymentTitle, propertyName: property?.address };
              const dueDate = billForDetails.dueDay ? nextBillDueDate(billForDetails.dueDay) : undefined;
              const missing = missingPaymentDetails(details);
              return <>
                <Text accessibilityLabel="Okres rozliczeniowy płatności" style={{ ...muted, marginBottom: 10 }}>Okres rozliczenia: {billPaymentPeriod}</Text>
                <PaymentDetail label="Odbiorca" value={details.recipientName} onCopy={() => void copyPaymentValue(details.recipientName, "Nazwa odbiorcy")} />
                <PaymentDetail label="Numer rachunku" value={details.bankAccount} onCopy={() => void copyPaymentValue(details.bankAccount, "Numer rachunku")} />
                <PaymentDetail label={billForDetails.variableAmount ? "Kwota do sprawdzenia" : "Kwota"} value={details.amount ? formatPlnAmount(details.amount) : "Sprawdź bieżącą kwotę"} onCopy={() => void copyPaymentValue(details.amount, "Kwota")} />
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
  return formatPolishDate(due, "long");
}

function updatedRentSchedule(property: Property | null, rate: NonNullable<Property["rentSchedule"]>[number]) {
  const existing = property?.rentSchedule ?? [];
  return [...existing.filter((item) => item.effectiveFrom !== rate.effectiveFrom), rate].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function shiftMonthValue(month: string, delta: number) {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(year!, part! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function bootstrapMonthCount(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return Math.max(0, (endYear! - startYear!) * 12 + endMonth! - startMonth! + 1);
}

function shiftBootstrapRange(range: { startMonth: string; endMonth: string }, property: Property, key: "startMonth" | "endMonth", delta: number) {
  const today = todayIsoDate();
  const yearStart = `${today.slice(0, 4)}-01`;
  const lastCompleted = shiftMonthValue(today.slice(0, 7), -1);
  const minimum = property.rentalStartDate && property.rentalStartDate.slice(0, 7) > yearStart ? property.rentalStartDate.slice(0, 7) : yearStart;
  const candidate = shiftMonthValue(range[key], delta);
  if (key === "startMonth") return { ...range, startMonth: candidate < minimum ? minimum : candidate > range.endMonth ? range.endMonth : candidate };
  return { ...range, endMonth: candidate > lastCompleted ? lastCompleted : candidate < range.startMonth ? range.startMonth : candidate };
}

function tenantDraftTotal(draft: PropertyDraft) {
  const ownerRent = draft.ownerRent.trim().replace(",", ".") || "0";
  const mediaAmount = draft.mediaAmount.trim().replace(",", ".") || "0";
  if (!isNonnegativeMoney(ownerRent) || !isNonnegativeMoney(mediaAmount)) return "—";
  return formatPlnAmount(decimalFromGrosz(tenantMonthlyTotalGrosz({ ownerRent, mediaAmount, mediaPaidByTenant: draft.mediaPaidByTenant })));
}

function optional(
  key:
    | "tenantName"
    | "tenantPhone"
    | "tenantEmail"
    | "leaseEndDate"
    | "administrationName"
    | "administrationUrl"
    | "electricityProvider"
    | "electricityUrl"
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
const categoryLabel = { color: theme.colors.textPrimary, fontWeight: "600" as const, fontSize: 16 };
const rowTitle = { color: theme.colors.textPrimary, fontWeight: "600" as const, fontSize: 16 };
const apartmentCard = { paddingHorizontal: 14, paddingVertical: 12, marginVertical: 5, minHeight: 78 };
const apartmentTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "600" as const };
const apartmentTenant = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 };
const apartmentMeta = { color: theme.colors.textSecondary, fontSize: 14, marginTop: 7 };
const settingsBack = { minHeight: 44, justifyContent: "center" as const, marginBottom: 6 };
const notificationRow = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const secondaryButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, minHeight: 44, borderRadius: 13, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 14, marginVertical: 8, backgroundColor: theme.colors.surface };
const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 6 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
const staticPaymentValue = { color: theme.colors.textPrimary, fontSize: 16, minHeight: 38, paddingVertical: 7 };
const helperText = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 };
const validationError = { color: theme.colors.danger, fontSize: 13, marginTop: 3 };
const invalidInput = { borderColor: theme.colors.danger };
const disabledControl = { opacity: 0.45 };
const neutralBanner = { backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 };
const disclosureRow = { minHeight: 44, justifyContent: "center" as const, marginTop: 4 };
const disclosureTitle = { color: theme.colors.primary, fontSize: 14, fontWeight: "600" as const };
const legalText = { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, paddingBottom: 8 };
const billsEmptyState = { padding: 18, alignItems: "stretch" as const, gap: 2 };
const emptyStateTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "600" as const };
const trustCard = { padding: 16 };
const clearDataButton = { minHeight: 46, justifyContent: "center" as const, alignItems: "center" as const, marginTop: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.danger, borderRadius: 12 };
const clearDataText = { color: theme.colors.danger, fontSize: 14, fontWeight: "700" as const };
const modalHeader = { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const };
const modalTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const taxableOption = { minHeight: 56, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginTop: 7, backgroundColor: theme.colors.surface };
const taxableOptionSelected = { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.selectedSurface };
const radioMark = { width: 22, color: theme.colors.textMuted, fontSize: 20, textAlign: "center" as const };
const radioMarkSelected = { color: theme.colors.accent };
const taxableOptionLabel = { color: theme.colors.textPrimary, flex: 1, fontSize: 14 };
const taxableOptionLabelSelected = { fontWeight: "600" as const };
const disclosureRow = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingVertical: 12 };
const disclosureChevron = { color: theme.colors.textSecondary, fontSize: 18, fontWeight: "700" as const };

const };
