import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createId,
  todayIsoDate,
  useRentalData,
} from "../data/RentalDataProvider";
import type { IncomeEntry, RentalDocument } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { createIncomeEntry } from "../domain/rentalOperations";
import { formatPlnAmount, moneyToGrosz } from "../domain/ryczaltTax";
import { decimalFromGrosz, defaultTaxableAmountGrosz } from "../domain/apartmentPayments";
import { IncomeEntryRow } from "../components/income/IncomeEntryRow";
import { PeriodSelector } from "../components/PeriodSelector";
import { formatPolishMonthName, formatPolishCount, formatPlnSummary } from "../domain/presentationFormat";
import { groupIncomeEntriesByReceivedMonth, historicalIncomeGroups, incomeEntriesForView, incomeRangeSummary, propertiesWithIncomeInYear } from "../domain/incomeHistory";
import { toggleIncomeMonth } from "../domain/incomeHistory";
import { apartmentTermsForMonth } from "../domain/apartmentTerms";
import { availableIncomeYears } from "../domain/dashboardPeriods";
import { rentMonthAmounts } from "../domain/rentAllocation";
import {
  compareDecimalStrings,
  isNonnegativeMoney,
  isPositiveMoney,
  isFullPaymentAmount,
  isRentalMonth,
  RentalValidationError,
} from "../domain/rentalValidation";

type PaymentDraft = {
  propertyId: string;
  amount: string;
  taxableAmount: string;
  rentalMonth: string;
};
const blankDraft = (): PaymentDraft => ({
  propertyId: "",
  amount: "",
  taxableAmount: "",
  rentalMonth: "",
});

export function IncomeScreen() {
  const { document, error, update } = useRentalData();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [modalOpen, setModalOpen] = useState(false);
  const [returnToTab, setReturnToTab] = useState<string | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(blankDraft());
  const [taxableExpanded, setTaxableExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const properties = useMemo(() => document?.properties ?? [], [document?.properties]);
  const [selectedTaxYear, setSelectedTaxYear] = useState<number | null>(null);
  const currentMonth = todayIsoDate().slice(0, 7);
  const confirmationRentalMonth = isRentalMonth(draft.rentalMonth)
    ? draft.rentalMonth
    : currentMonth;
  const confirmationProperties = useMemo(() => properties.filter((property) =>
    rentMonthAmounts(property, document?.incomeEntries ?? [], confirmationRentalMonth).remainingGrosz! > 0,
  ), [properties, document?.incomeEntries, confirmationRentalMonth]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [historicalRangeExpanded, setHistoricalRangeExpanded] = useState(false);
  const currentYear = new Date().getFullYear();
  const incomeYears = availableIncomeYears(
    properties,
    document?.incomeEntries ?? [],
    document?.settings.openingTaxableRevenue && moneyToGrosz(document.settings.openingTaxableRevenue) > 0 ? document.settings.taxYear : undefined,
  );
  const latestYear = incomeYears.at(-1) ?? currentYear;
  const taxYear = incomeYears.includes(selectedTaxYear ?? latestYear) ? selectedTaxYear ?? latestYear : latestYear;
  const taxYearIndex = incomeYears.indexOf(taxYear);
  const orderedEntries = useMemo(
    () => (document ? incomeEntriesForView(document.incomeEntries, taxYear, selectedPropertyId) : []),
    [document, taxYear, selectedPropertyId],
  );
  const groups = useMemo(() => groupIncomeEntriesByReceivedMonth(orderedEntries), [orderedEntries]);
  const historyGroups = useMemo(() => historicalIncomeGroups(groups, currentMonth), [groups, currentMonth]);
  const historyRange = useMemo(() => incomeRangeSummary(historyGroups), [historyGroups]);
  useEffect(() => {
    setExpandedMonths([]);
    setHistoricalRangeExpanded(false);
  }, [taxYear, selectedPropertyId]);
  const showHistoricalMonths = historyGroups.length <= 1 || historicalRangeExpanded;
  const sections = showHistoricalMonths ? historyGroups.map(({ entries, ...section }) => ({ ...section, paymentCount: entries.length, data: expandedMonths.includes(section.month) ? entries : [] })) : [];
  const availableProperties = propertiesWithIncomeInYear(properties, document?.incomeEntries ?? [], taxYear);
  const propertyNames = new Map(properties.map((property) => [property.id, property.address]));
  const selectedPropertyName = selectedPropertyId ? propertyNames.get(selectedPropertyId) ?? "Usunięte mieszkanie" : null;
  const closeEntryModal = () => {
    setModalOpen(false);
    if (returnToTab) {
      const tab = returnToTab;
      setReturnToTab(null);
      navigation.navigate(tab);
    }
  };
  useEffect(() => {
    const params = route.params as { propertyId?: string; rentalMonth?: string; quickAdd?: boolean; expectedAmount?: string; returnTo?: string } | undefined;
    const property = params?.propertyId ? properties.find((item) => item.id === params.propertyId) : undefined;
    if (params?.quickAdd) {
      setReturnToTab(params.returnTo ?? null);
      const period = params.rentalMonth ?? todayIsoDate().slice(0, 7);
      const eligibleProperties = properties.filter((item) => rentMonthAmounts(item, document?.incomeEntries ?? [], period).remainingGrosz! > 0);
      const selected = property && eligibleProperties.some((item) => item.id === property.id) ? property : eligibleProperties[0];
      const amount = selected ? decimalFromGrosz(rentMonthAmounts(selected, document?.incomeEntries ?? [], period).remainingGrosz ?? 0) : "";
      setTaxableExpanded(false);
      const taxable = selected && (apartmentTermsForMonth(selected, period)?.taxableTreatment ?? selected.taxableTreatment) && amount ? decimalFromGrosz(defaultTaxableAmountGrosz({ property: selected, amountGrosz: moneyToGrosz(amount), rentalMonth: period, priorEntries: document?.incomeEntries ?? [] })) : "";
      setDraft({ ...blankDraft(), propertyId: selected?.id ?? "", amount,
        taxableAmount: taxable, rentalMonth: params.rentalMonth ?? "" });
      setModalOpen(true);
      navigation.setParams({ quickAdd: undefined, expectedAmount: undefined, propertyId: undefined, rentalMonth: undefined, returnTo: undefined });
      return;
    }
    if (!property || !params?.rentalMonth) return;
    const eligibleProperty = rentMonthAmounts(property, document?.incomeEntries ?? [], params.rentalMonth).remainingGrosz! > 0 ? property : undefined;
    const selected = eligibleProperty ?? properties.find((item) => rentMonthAmounts(item, document?.incomeEntries ?? [], params.rentalMonth!).remainingGrosz! > 0);
    if (!selected) return;
    setTaxableExpanded(false);
    const amount = decimalFromGrosz(rentMonthAmounts(selected, document?.incomeEntries ?? [], params.rentalMonth).remainingGrosz ?? 0);
    const terms = apartmentTermsForMonth(selected, params.rentalMonth);
    setDraft({ ...blankDraft(), propertyId: selected.id, amount, taxableAmount: terms ? decimalFromGrosz(terms.ownerRentGrosz) : selected.ownerRent ?? "", rentalMonth: params.rentalMonth });
    setModalOpen(true);
    navigation.setParams({ propertyId: undefined, rentalMonth: undefined });
  // Notification actions are consumed once the document has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, route.params]);
  useEffect(() => {
    if (!modalOpen || confirmationProperties.some((property) => property.id === draft.propertyId)) return;
    const property = confirmationProperties[0];
    if (!property) {
      setDraft((current) => current.propertyId || current.amount || current.taxableAmount
        ? { ...current, propertyId: "", amount: "", taxableAmount: "" }
        : current);
      return;
    }
    const amount = decimalFromGrosz(rentMonthAmounts(property, document?.incomeEntries ?? [], confirmationRentalMonth).remainingGrosz ?? 0);
    const terms = apartmentTermsForMonth(property, confirmationRentalMonth);
    const taxableAmount = (terms?.taxableTreatment ?? property.taxableTreatment) && amount
      ? decimalFromGrosz(defaultTaxableAmountGrosz({ property, amountGrosz: moneyToGrosz(amount), rentalMonth: confirmationRentalMonth, priorEntries: document?.incomeEntries ?? [] }))
      : "";
    setDraft((current) => ({ ...current, propertyId: property.id, amount, taxableAmount }));
  }, [modalOpen, confirmationProperties, confirmationRentalMonth, draft.propertyId, document?.incomeEntries]);
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

  const openEntryMenu = (entry: IncomeEntry) => Alert.alert("Wpłata", undefined, [
    ...(incomeEntryPeriodClosed(entry, document) ? [{ text: "Okres jest zamknięty", onPress: () => Alert.alert("Okres jest zamknięty", "Korekty zamkniętych okresów będą dostępne w osobnym, audytowanym przepływie.") }] : [
      { text: "Usuń wpłatę", style: "destructive" as const, onPress: () => remove(entry) },
    ]),
    { text: "Anuluj", style: "cancel" },
  ]);
  const chooseProperty = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    if (!property || rentMonthAmounts(property, document.incomeEntries, confirmationRentalMonth).remainingGrosz! <= 0) return;
    setDraft((current) => {
      const rentalMonth = current.rentalMonth || currentMonth;
      const amount = decimalFromGrosz(rentMonthAmounts(property, document.incomeEntries, rentalMonth).remainingGrosz ?? 0);
      const terms = apartmentTermsForMonth(property, rentalMonth);
      const taxableAmount = (terms?.taxableTreatment ?? property.taxableTreatment) && amount
        ? decimalFromGrosz(defaultTaxableAmountGrosz({
            property,
            amountGrosz: moneyToGrosz(amount),
            rentalMonth,
            priorEntries: document.incomeEntries,
          }))
        : "";
      return { ...current, propertyId, amount, taxableAmount };
    });
  };
  const save = async () => {
    const amount = draft.amount.trim().replace(",", ".");
    if (!properties.some((property) => property.id === draft.propertyId)) {
      Alert.alert(
        "Wybierz mieszkanie",
        "Najpierw dodaj mieszkanie i wybierz je dla wpłaty.",
      );
      return;
    }
    if (!(apartmentTermsForMonth(properties.find((property) => property.id === draft.propertyId)!, draft.rentalMonth || currentMonth)?.taxableTreatment ?? properties.find((property) => property.id === draft.propertyId)?.taxableTreatment)) {
      Alert.alert("Ustaw sposób opodatkowania", "Wybierz go w Ustawieniach mieszkania zgodnie z warunkami umowy najmu.");
      return;
    }
    const rentalPeriod = draft.rentalMonth || currentMonth;
    const property = properties.find((item) => item.id === draft.propertyId)!;
    const rentStatus = rentMonthAmounts(property, document.incomeEntries, rentalPeriod);
    const expected = rentStatus.expectedGrosz;
    if (expected === null || rentStatus.remainingGrosz === null || rentStatus.remainingGrosz <= 0 || !isFullPaymentAmount(amount, rentStatus.remainingGrosz)) {
      Alert.alert("Potwierdź pełną wpłatę", "Można potwierdzić tylko całą pozostałą kwotę czynszu.");
      return;
    }
    const taxableAmount = taxableExpanded ? draft.taxableAmount.trim().replace(",", ".") : decimalFromGrosz(defaultTaxableAmountGrosz({
      property: properties.find((property) => property.id === draft.propertyId)!,
      amountGrosz: moneyToGrosz(amount),
      rentalMonth: rentalPeriod,
      priorEntries: document.incomeEntries,
    }));
    if (!isPositiveMoney(amount)) {
      Alert.alert(
        "Nieprawidłowa kwota",
        "Wpisz otrzymaną kwotę większą od zera, maksymalnie do dwóch miejsc po przecinku.",
      );
      return;
    }
    if (!isNonnegativeMoney(taxableAmount)) {
      Alert.alert(
        "Nieprawidłowa kwota podatkowa",
        "Wpisz kwotę nieujemną, maksymalnie do dwóch miejsc po przecinku.",
      );
      return;
    }
    if (draft.rentalMonth && !isRentalMonth(draft.rentalMonth)) {
      Alert.alert(
        "Nieprawidłowy miesiąc",
        "Wpisz miesiąc najmu w formacie RRRR-MM.",
      );
      return;
    }
    const candidatePeriod = draft.rentalMonth || currentMonth;
    if ((document.apartmentPeriods ?? []).some((snapshot) => snapshot.propertyId === draft.propertyId && snapshot.month === candidatePeriod) || (document.taxSettlementSnapshots ?? []).some((snapshot) => snapshot.period === currentMonth)) {
      Alert.alert("Okres jest zamknięty", "Nie można zmieniać wpłat w zamkniętym okresie. Audytowane korekty historyczne będą dostępne w przyszłości.");
      return;
    }
    const selected = properties.find(
      (property) => property.id === draft.propertyId,
    )!;
    let entry: IncomeEntry;
    try {
      entry = createIncomeEntry(
            {
              propertyId: draft.propertyId,
              receivedAt: todayIsoDate(),
              amount,
              taxableAmount,
              rentalMonth: draft.rentalMonth,
            },
            selected,
            createId("income"),
          );
    } catch (error) {
      Alert.alert(
        "Nieprawidłowa wpłata",
        error instanceof RentalValidationError
          ? error.message
          : "Sprawdź dane wpłaty.",
      );
      return;
    }
    const persist = async () => {
      setSaving(true);
      try {
        await update((current) => ({
          ...current,
          incomeEntries: [...current.incomeEntries, entry],
        }));
        closeEntryModal();
      } catch {
        /* The provider reports the save failure. */
      } finally {
        setSaving(false);
      }
    };

    const warnings: string[] = [];
    if (compareDecimalStrings(amount, "100000") > 0) {
      warnings.push(
        `Kwota ${formatPlnAmount(amount)} jest bardzo wysoka. Sprawdź, czy nie ma pomyłki.`,
      );
    }
    if (warnings.length) {
      Alert.alert("Sprawdź wpłatę", warnings.join("\n\n"), [
        { text: "Wróć do edycji", style: "cancel" },
        { text: "Zapisz mimo to", onPress: () => void persist() },
      ]);
      return;
    }
    void persist();
  };
  const remove = (entry: IncomeEntry) => {
    if (incomeEntryPeriodClosed(entry, document)) {
      Alert.alert("Okres jest zamknięty", "Korekty zamkniętych okresów będą dostępne w osobnym, audytowanym przepływie.");
      return;
    }
    if (deletingId) return;
    Alert.alert(
      "Usunąć wpłatę?",
      `Wpłata ${formatPlnAmount(entry.amount)}${propertyNames.get(entry.propertyId) ? ` za ${propertyNames.get(entry.propertyId)}` : ""} zostanie usunięta z przychodu i może zmienić wyliczenie podatku.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () => {
            setDeletingId(entry.id);
            void update((current) => ({
              ...current,
              incomeEntries: current.incomeEntries.filter(
                (item) => item.id !== entry.id,
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
    key:
      "amount" | "taxableAmount" | "rentalMonth",
    options: {
      keyboardType?: "default" | "decimal-pad";
      placeholder?: string;
    } = {},
  ) => (
    <View style={{ marginBottom: 14 }} key={key}>
      <Text style={ui.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={draft[key]}
        onChangeText={(value) => setDraft((current) => {
          if (key === "rentalMonth") {
            const nextDraft = { ...current, [key]: value };
            const property = properties.find((item) => item.id === current.propertyId);
            const rentalMonth = nextDraft.rentalMonth || currentMonth;
            return property && isRentalMonth(rentalMonth)
              ? { ...nextDraft, amount: decimalFromGrosz(rentMonthAmounts(property, document.incomeEntries, rentalMonth).remainingGrosz ?? 0) }
              : nextDraft;
          }
          return { ...current, [key]: value };
        })}
        keyboardType={options.keyboardType}
        editable={key !== "amount"}
        placeholder={options.placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[ui.input, { paddingVertical: 10 }]}
      />
    </View>
  );

  return (
    <View style={ui.page}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ ...ui.content, flexGrow: 1 }}
        ListHeaderComponent={<View style={{ paddingBottom: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Wróć do pulpitu" onPress={() => navigation.navigate("Przegląd")} style={backToDashboard}>
            <MaterialIcons name="chevron-left" size={20} color={theme.colors.textSecondary} />
            <Text style={backToDashboardText}>Pulpit</Text>
          </Pressable>
          <Text style={ui.pageTitle}>Wpłaty</Text>
          <PeriodSelector value={String(taxYear)} valueLabel={`Rok ${taxYear}`} previousLabel="Poprzedni rok" nextLabel="Następny rok"
            previousDisabled={taxYearIndex <= 0} nextDisabled={taxYearIndex >= incomeYears.length - 1 || taxYear >= currentYear}
            onPrevious={() => setSelectedTaxYear(incomeYears[taxYearIndex - 1]!)} onNext={() => setSelectedTaxYear(incomeYears[taxYearIndex + 1]!)} />
          {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
          {availableProperties.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={`Filtr mieszkań: ${selectedPropertyName ?? "Wszystkie mieszkania"}`} accessibilityHint="Otwiera wybór mieszkania" onPress={() => setFilterOpen(true)} style={filterControl}>
            <Text numberOfLines={1} style={filterSelected}>{selectedPropertyName ?? "Wszystkie mieszkania"}</Text><MaterialIcons name="expand-more" size={24} color={theme.colors.textSecondary} />
          </Pressable> : null}
          <Text style={historyTitle}>Historia wpłat</Text>
          {historyRange && historyRange.monthCount > 1 ? <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: historicalRangeExpanded }}
            accessibilityLabel={`${formatPolishMonthName(historyRange.earliestMonth).toLocaleUpperCase("pl-PL")} – ${formatPolishMonthName(historyRange.latestMonth).toLocaleUpperCase("pl-PL")}, ${formatPolishCount(historyRange.monthCount, ["miesiąc", "miesiące", "miesięcy"])}, ${formatPlnSummary(historyRange.totalGrosz)}, ${formatPolishCount(historyRange.paymentCount, ["wpłata", "wpłaty", "wpłat"])}`}
            onPress={() => setHistoricalRangeExpanded((value) => !value)}
            style={rangeHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={rangeLabel}>{formatPolishMonthName(historyRange.earliestMonth).toLocaleUpperCase("pl-PL")} – {formatPolishMonthName(historyRange.latestMonth).toLocaleUpperCase("pl-PL")}</Text>
              <Text style={monthTotal}>{formatPolishCount(historyRange.monthCount, ["miesiąc", "miesiące", "miesięcy"])} · {formatPlnSummary(historyRange.totalGrosz)} · {formatPolishCount(historyRange.paymentCount, ["wpłata", "wpłaty", "wpłat"])}</Text>
            </View>
            <MaterialIcons name={historicalRangeExpanded ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
          </Pressable> : null}
        </View>}
        renderSectionHeader={({ section }) => {
          const expanded = expandedMonths.includes(section.month);
          const amountSummary = `${formatPlnSummary(section.totalGrosz)} · ${formatPolishCount(section.paymentCount, ["wpłata", "wpłaty", "wpłat"])}`;
          const closed = (document.taxSettlementSnapshots ?? []).some((snapshot) => snapshot.period === section.month);
          return <View style={monthHeader}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${formatPolishMonthName(section.month)}, ${amountSummary}`} onPress={() => setExpandedMonths((items) => toggleIncomeMonth(items, section.month))} style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48 }}>
              <View style={{ flex: 1 }}><Text style={monthLabel}>{formatPolishMonthName(section.month).toLocaleUpperCase("pl-PL")}</Text><Text style={monthTotal}>{amountSummary}</Text></View><MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
            </Pressable>
            {closed ? <Text style={periodClosedLabel}>Zamknięty</Text> : null}
          </View>;
        }}
        renderItem={({ item }) => <IncomeEntryRow entry={item} propertyName={propertyNames.get(item.propertyId) ?? "Usunięte mieszkanie"} onOpen={() => openEntryMenu(item)} />}
        ListEmptyComponent={historyGroups.length === 0 ? <View style={emptyHistory}><Text style={emptyText}>{selectedPropertyName ? `Brak wcześniejszych potwierdzonych wpłat dla ${selectedPropertyName}.` : "Brak wcześniejszych potwierdzonych wpłat."}</Text></View> : null}
      />
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={filterBackdrop}><SafeAreaView edges={modalSafeAreaEdges} style={filterSheet}>
          <View style={sheetHeader}><Text style={sheetTitle}>Mieszkanie</Text><Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)}><Text style={action}>Zamknij</Text></Pressable></View>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {[{ id: null, label: "Wszystkie mieszkania" }, ...availableProperties.map((property) => ({ id: property.id, label: property.address }))].map((item) => <Pressable key={item.id ?? "all"} accessibilityRole="radio" accessibilityState={{ checked: selectedPropertyId === item.id }} onPress={() => { setSelectedPropertyId(item.id); setFilterOpen(false); }} style={filterOption}>
              <Text style={optionMark}>{selectedPropertyId === item.id ? "✓" : ""}</Text><Text numberOfLines={1} style={filterSelected}>{item.label}</Text>
            </Pressable>)}
          </ScrollView>
        </SafeAreaView></View>
      </Modal>
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={closeEntryModal}
      >
        <SafeAreaView edges={modalSafeAreaEdges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={ui.modalHeader}>
            <Text style={ui.modalTitle}>Potwierdź wpłatę</Text>
            <Text onPress={closeEntryModal} accessibilityRole="button" style={action}>Zamknij</Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20 }}
          >
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>Mieszkanie</Text>
            {confirmationProperties.length === 1 ? <View style={selectedApartmentSummary}>
              <MaterialIcons name="home" size={20} color={theme.colors.textSecondary} />
              <Text style={selectedApartmentText}>{confirmationProperties[0]!.address}</Text>
            </View> : confirmationProperties.map((property) => (
              <Pressable
                key={property.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.propertyId === property.id }}
                onPress={() => chooseProperty(property.id)}
                style={[apartmentChoice, draft.propertyId === property.id && apartmentChoiceSelected]}
              >
                <MaterialIcons name={draft.propertyId === property.id ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={draft.propertyId === property.id ? theme.colors.success : theme.colors.textMuted} />
                <Text style={[apartmentChoiceText, draft.propertyId === property.id && apartmentChoiceTextSelected]}>{property.address}</Text>
              </Pressable>
            ))}
            {confirmationProperties.length === 0 ? <Text style={{ color: theme.colors.textSecondary, marginBottom: 12 }}>Wszystkie mieszkania mają już potwierdzony czynsz za ten miesiąc.</Text> : null}
            {(() => { const property = properties.find((item) => item.id === draft.propertyId); return property ? <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>{property.taxableTreatment ? `Podstawa wg ustawienia mieszkania: ${property.taxableTreatment === "OWNER_RENT" ? "czynsz dla właściciela" : "czynsz i opłaty dodatkowe"}.` : "Ustaw sposób wliczania opłat do przychodu w edycji mieszkania przed potwierdzeniem wpłaty."}</Text> : null; })()}
            <View style={{ marginBottom: 14 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Kwota do potwierdzenia</Text><Text accessibilityLabel="Kwota do potwierdzenia" style={{ color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 13 }}>{isNonnegativeMoney(draft.amount) ? formatPlnAmount(draft.amount) : "—"}</Text></View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTaxableExpanded((value) => !value)}
              style={{ paddingVertical: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={secondaryDisclosureText}>
                  {taxableExpanded
                    ? "Ukryj kwotę podlegającą opodatkowaniu"
                    : "Ustaw kwotę podlegającą opodatkowaniu"}
                </Text>
                <MaterialIcons name={taxableExpanded ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
              </View>
            </Pressable>
            {taxableExpanded
              ? field("Kwota podlegająca opodatkowaniu (zł)", "taxableAmount", {
                  keyboardType: "decimal-pad",
                  placeholder: "Domyślnie kwota otrzymana",
                })
              : null}
            {field("Miesiąc najmu", "rentalMonth", {
              placeholder: currentMonth,
            })}
            <Pressable
              accessibilityRole="button"
              disabled={saving || !draft.propertyId || confirmationProperties.length === 0}
              onPress={() => void save()}
              style={[primaryButton, (saving || !draft.propertyId || confirmationProperties.length === 0) && { opacity: 0.6 }]}
            >
              <Text style={primaryText}>
                {saving ? "Zapisywanie…" : "Potwierdź wpłatę"}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function incomeEntryPeriodClosed(entry: IncomeEntry, document: RentalDocument) {
  const rentalMonth = entry.rentalMonth ?? entry.receivedAt.slice(0, 7);
  return (document.apartmentPeriods ?? []).some((snapshot) => snapshot.propertyId === entry.propertyId && snapshot.month === rentalMonth)
    || (document.taxSettlementSnapshots ?? []).some((snapshot) => snapshot.period === entry.receivedAt.slice(0, 7));
}

const primaryButton = ui.primaryButton;
const primaryText = {
  color: theme.colors.onAccent,
  fontWeight: "700" as const,
  fontSize: 15,
};
const backToDashboard = { minHeight: 40, flexDirection: "row" as const, alignItems: "center" as const, alignSelf: "flex-start" as const, marginBottom: 4, marginLeft: -6, paddingHorizontal: 2 };
const backToDashboardText = { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" as const };
const action = {
  color: theme.colors.primary,
  fontWeight: "600" as const,
  paddingVertical: 5,
};
const secondaryDisclosureText = { color: theme.colors.textPrimary, fontWeight: "600" as const, paddingVertical: 5 };
const selectedApartmentSummary = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surfaceMuted };
const selectedApartmentText = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, flex: 1 };
const apartmentChoice = { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 12, marginBottom: 7, borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 12, backgroundColor: theme.colors.surface };
const apartmentChoiceSelected = { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.selectedSurface };
const apartmentChoiceText = { flex: 1, color: theme.colors.textPrimary, fontWeight: "400" as const };
const apartmentChoiceTextSelected = { fontWeight: "600" as const };
const filterControl = { marginTop: 8, minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, paddingHorizontal: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12 };
const filterSelected = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, flex: 1 };
const historyTitle = { ...ui.sectionTitle, marginTop: 16, marginBottom: 4 };
const rangeHeader = { minHeight: 58, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 8, paddingHorizontal: 10, marginTop: 3, backgroundColor: theme.colors.surfaceMuted, borderRadius: 10 };
const rangeLabel = { color: theme.colors.textPrimary, fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.25 };
const monthHeader = { minHeight: 58, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.divider };
const monthLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.4 };
const monthTotal = { color: theme.colors.textPrimary, fontSize: 12, fontWeight: "600" as const, marginTop: 3 };
const periodClosedLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "600" as const, paddingHorizontal: 8 };
const emptyHistory = { paddingVertical: 20 };
const emptyText = { color: theme.colors.textSecondary, fontSize: 14 };
const filterBackdrop = { flex: 1, justifyContent: "flex-end" as const, backgroundColor: "rgba(0,0,0,0.35)" };
const filterSheet = { maxHeight: "75%" as const, paddingHorizontal: 20, paddingTop: 16, backgroundColor: theme.colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18 };
const sheetHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingBottom: 12 };
const sheetTitle = { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" as const };
const filterOption = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderTopWidth: 1, borderColor: theme.colors.divider };
const optionMark = { width: 20, color: theme.colors.primary, fontSize: 16, fontWeight: "700" as const };

