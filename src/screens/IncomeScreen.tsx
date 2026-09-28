import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
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
import type { IncomeEntry } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { createIncomeEntry, editIncomeEntry } from "../domain/rentalOperations";
import { formatPln, formatPlnAmount, moneyToGrosz } from "../domain/ryczaltTax";
import { decimalFromGrosz, defaultTaxableAmountGrosz, tenantMonthlyTotalGrosz } from "../domain/apartmentPayments";
import { IncomeEntryRow } from "../components/income/IncomeEntryRow";
import { IncomeHistoryChart } from "../components/income/IncomeHistoryChart";
import { PeriodSelector } from "../components/PeriodSelector";
import { StatusBadge } from "../components/StatusBadge";
import { formatPolishMonth, formatPolishMonthName, formatPolishCount, formatPlnSummary } from "../domain/presentationFormat";
import { groupIncomeEntriesByReceivedMonth, historicalIncomeGroups, incomeEntriesForView, incomeRangeSummary, incomeViewSummary, propertiesWithIncomeInYear, rentMonthStatusRows } from "../domain/incomeHistory";
import { toggleIncomeMonth } from "../domain/incomeHistory";
import { availableIncomeYears } from "../domain/dashboardPeriods";
import {
  compareDecimalStrings,
  isNonnegativeMoney,
  isPositiveMoney,
  isRentalMonth,
  isValidCalendarDate,
  RentalValidationError,
} from "../domain/rentalValidation";

type PaymentDraft = {
  propertyId: string;
  amount: string;
  taxableAmount: string;
  receivedAt: string;
  rentalMonth: string;
  description: string;
};
const blankDraft = (): PaymentDraft => ({
  propertyId: "",
  amount: "",
  taxableAmount: "",
  receivedAt: todayIsoDate(),
  rentalMonth: "",
  description: "",
});

export function IncomeScreen() {
  const { document, error, update } = useRentalData();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(blankDraft());
  const [taxableExpanded, setTaxableExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const properties = document?.properties ?? [];
  const [selectedTaxYear, setSelectedTaxYear] = useState<number | null>(null);
  const currentMonth = todayIsoDate().slice(0, 7);
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
  const visibleProperties = selectedPropertyId ? properties.filter((property) => property.id === selectedPropertyId) : properties;
  const rentRows = rentMonthStatusRows(visibleProperties, document?.incomeEntries ?? [], currentMonth);
  const showHistoricalMonths = historyGroups.length <= 1 || historicalRangeExpanded;
  const sections = showHistoricalMonths ? historyGroups.map(({ entries, ...section }) => ({ ...section, paymentCount: entries.length, data: expandedMonths.includes(section.month) ? entries : [] })) : [];
  const summary = incomeViewSummary(orderedEntries);
  const availableProperties = propertiesWithIncomeInYear(properties, document?.incomeEntries ?? [], taxYear);
  const propertyNames = new Map(properties.map((property) => [property.id, property.address]));
  const selectedPropertyName = selectedPropertyId ? propertyNames.get(selectedPropertyId) ?? "Usunięte mieszkanie" : null;
  useEffect(() => {
    const params = route.params as { propertyId?: string; rentalMonth?: string; quickAdd?: boolean; expectedAmount?: string } | undefined;
    const property = params?.propertyId ? properties.find((item) => item.id === params.propertyId) : undefined;
    if (params?.quickAdd) {
      const amount = params.expectedAmount ?? (property ? decimalFromGrosz(tenantMonthlyTotalGrosz(property)) : "");
      setEditing(null);
      setTaxableExpanded(false);
      const selected = property ?? properties[0];
      const period = params.rentalMonth ?? todayIsoDate().slice(0, 7);
      const taxable = selected && amount ? decimalFromGrosz(defaultTaxableAmountGrosz({ property: selected, amountGrosz: moneyToGrosz(amount), rentalMonth: period, priorEntries: document?.incomeEntries ?? [] })) : amount;
      setDraft({ ...blankDraft(), propertyId: property?.id ?? selected?.id ?? "", amount,
        taxableAmount: taxable, rentalMonth: params.rentalMonth ?? "" });
      setModalOpen(true);
      navigation.setParams({ quickAdd: undefined, expectedAmount: undefined, propertyId: undefined, rentalMonth: undefined });
      return;
    }
    if (!property || !params?.rentalMonth) return;
    setEditing(null);
    setTaxableExpanded(false);
    const amount = decimalFromGrosz(tenantMonthlyTotalGrosz(property));
    setDraft({ ...blankDraft(), propertyId: property.id, amount, taxableAmount: property.ownerRent ?? "", rentalMonth: params.rentalMonth });
    setModalOpen(true);
    navigation.setParams({ propertyId: undefined, rentalMonth: undefined });
  // Notification actions are consumed once the document has loaded.
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

  const openEntryMenu = (entry: IncomeEntry) => Alert.alert("Wpłata", undefined, [
    { text: "Edytuj", onPress: () => openEdit(entry) },
    { text: "Usuń wpłatę", style: "destructive", onPress: () => remove(entry) },
    { text: "Anuluj", style: "cancel" },
  ]);
  const openEdit = (entry: IncomeEntry) => {
    setEditing(entry);
    setTaxableExpanded(entry.taxableAmount !== entry.amount);
    setDraft({
      propertyId: entry.propertyId,
      amount: entry.amount,
      taxableAmount: entry.taxableAmount,
      receivedAt: entry.receivedAt,
      rentalMonth: entry.rentalMonth ?? "",
      description: entry.description ?? "",
    });
    setModalOpen(true);
  };
  const chooseProperty = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    setDraft((current) => ({
      ...current,
      propertyId,
      amount: current.amount || property?.ownerRent || "",
      taxableAmount:
        current.taxableAmount || property?.ownerRent || "",
    }));
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
    const rentalPeriod = draft.rentalMonth || draft.receivedAt.slice(0, 7);
    const taxableAmount = taxableExpanded ? draft.taxableAmount.trim().replace(",", ".") : decimalFromGrosz(defaultTaxableAmountGrosz({
      property: properties.find((property) => property.id === draft.propertyId)!,
      amountGrosz: moneyToGrosz(amount),
      rentalMonth: rentalPeriod,
      priorEntries: document.incomeEntries.filter((entry) => entry.id !== editing?.id),
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
    if (!isValidCalendarDate(draft.receivedAt)) {
      Alert.alert(
        "Nieprawidłowa data",
        "Wpisz rzeczywistą datę otrzymania w formacie RRRR-MM-DD.",
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
    const selected = properties.find(
      (property) => property.id === draft.propertyId,
    )!;
    let entry: IncomeEntry;
    try {
      entry = editing
        ? editIncomeEntry(editing, {
            propertyId: draft.propertyId,
            receivedAt: draft.receivedAt,
            amount,
            taxableAmount,
            rentalMonth: draft.rentalMonth,
            description: draft.description,
          })
        : createIncomeEntry(
            {
              propertyId: draft.propertyId,
              receivedAt: draft.receivedAt,
              amount,
              taxableAmount,
              rentalMonth: draft.rentalMonth,
              description: draft.description,
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
          incomeEntries: editing
            ? current.incomeEntries.map((item) =>
                item.id === editing.id ? entry : item,
              )
            : [...current.incomeEntries, entry],
        }));
        setModalOpen(false);
        setEditing(null);
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
    const today = todayIsoDate();
    if (draft.receivedAt > today) {
      warnings.push(
        `Data otrzymania ${draft.receivedAt} przypada w przyszłości. Sprawdź, czy wpłata została już otrzymana.`,
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
      "amount" | "taxableAmount" | "receivedAt" | "rentalMonth" | "description",
    options: {
      keyboardType?: "default" | "decimal-pad";
      placeholder?: string;
    } = {},
  ) => (
    <View style={{ marginBottom: 14 }} key={key}>
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
        value={draft[key]}
        onChangeText={(value) =>
          setDraft((current) => ({ ...current, [key]: value }))
        }
        keyboardType={options.keyboardType}
        placeholder={options.placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.inputBackground,
          borderColor: theme.colors.inputBorder,
          borderWidth: 1,
          borderRadius: 8,
          minHeight: 46,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
    </View>
  );

  return (
    <View style={ui.page}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={<View style={{ paddingBottom: 8 }}>
          <PeriodSelector value={String(taxYear)} valueLabel={`Rok ${taxYear}`} previousLabel="Poprzedni rok" nextLabel="Następny rok"
            previousDisabled={taxYearIndex <= 0} nextDisabled={taxYearIndex >= incomeYears.length - 1 || taxYear >= currentYear}
            onPrevious={() => setSelectedTaxYear(incomeYears[taxYearIndex - 1]!)} onNext={() => setSelectedTaxYear(incomeYears[taxYearIndex + 1]!)} />
          {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
          <View style={[ui.card, summaryCard]}>
            <Text style={summaryEyebrow}>Przychód opodatkowany z zapisanych wpływów</Text>
            <Text style={summaryAmount}>{formatPlnSummary(summary.totalGrosz)}</Text>
            <Text style={muted}>{summary.count ? `Na podstawie ${formatPolishCount(summary.count, ["potwierdzonego wpływu", "potwierdzonych wpływów", "potwierdzonych wpływów"])} · ${formatPolishCount(summary.propertyCount, ["mieszkanie", "mieszkania", "mieszkań"])}` : `Brak potwierdzonych wpływów w ${taxYear}.`}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filtr mieszkań: ${selectedPropertyName ?? "Wszystkie mieszkania"}`} accessibilityHint="Otwiera wybór mieszkania" onPress={() => setFilterOpen(true)} style={filterControl}>
            <Text numberOfLines={1} style={filterSelected}>{selectedPropertyName ?? "Wszystkie mieszkania"}</Text><Text style={action}>▼</Text>
          </Pressable>
          {taxYear === Number(currentMonth.slice(0, 4)) && rentRows.length > 0 ? <View style={[ui.card, rentStatusCard]}>
            <Text style={rentStatusHeading}>Czynsz za {formatPolishMonth(currentMonth)}</Text>
            {rentRows.map((row) => <View key={row.propertyId} style={rentStatusRow}>
              <View style={rentStatusTop}><Text style={rentPropertyName}>{row.address}</Text><StatusBadge label={row.status === "paid" ? "Potwierdzone" : row.status === "partial" ? "Częściowo otrzymano" : row.status === "unpaid" ? "Do potwierdzenia" : "Nieustalony"} tone={row.status === "paid" ? "positive" : row.status === "partial" || row.status === "unpaid" ? "attention" : "neutral"} /></View>
              {row.status === "paid" ? <Text style={rentDetailText}>{formatPln(row.confirmedGrosz)}</Text>
                : row.status === "partial" ? <><Text style={rentDetailText}>{formatPln(row.confirmedGrosz)} z {formatPln(row.expectedGrosz ?? 0)}</Text><Text style={rentDetailText}>Pozostało: {formatPln(row.remainingGrosz ?? 0)}</Text></>
                  : row.status === "unpaid" ? <Text style={rentDetailText}>{formatPln(row.remainingGrosz ?? 0)}</Text>
                    : <Text style={rentDetailText}>Oczekiwany czynsz: nieustalony</Text>}
            </View>)}
          </View> : null}
          <IncomeHistoryChart entries={document.incomeEntries} propertyId={selectedPropertyId} year={taxYear} />
          <Text style={historyTitle}>Potwierdzone wpłaty</Text>
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
            <Text style={monthChevron}>{historicalRangeExpanded ? "⌃" : "⌄"}</Text>
          </Pressable> : null}
        </View>}
        renderSectionHeader={({ section }) => {
          const expanded = expandedMonths.includes(section.month);
          const amountSummary = `${formatPlnSummary(section.totalGrosz)} · ${formatPolishCount(section.paymentCount, ["wpłata", "wpłaty", "wpłat"])}`;
          return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${formatPolishMonthName(section.month)}, ${amountSummary}`} onPress={() => setExpandedMonths((items) => toggleIncomeMonth(items, section.month))} style={monthHeader}>
          <View style={{ flex: 1 }}><Text style={monthLabel}>{formatPolishMonthName(section.month).toLocaleUpperCase("pl-PL")}</Text><Text style={monthTotal}>{amountSummary}</Text></View><Text style={monthChevron}>{expanded ? "⌃" : "⌄"}</Text>
          </Pressable>;
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
        onRequestClose={() => setModalOpen(false)}
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
              {editing ? "Edytuj wpłatę" : "Potwierdź wpłatę"}
            </Text>
            <Text
              onPress={() => setModalOpen(false)}
              accessibilityRole="button"
              style={action}
            >
              Zamknij
            </Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20 }}
          >
            <Text
              style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
            >
              Mieszkanie
            </Text>
            {properties.map((property) => (
              <Pressable
                key={property.id}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: draft.propertyId === property.id,
                }}
                onPress={() => chooseProperty(property.id)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor:
                    draft.propertyId === property.id
                      ? theme.colors.selectedBorder
                      : theme.colors.inputBorder,
                  borderRadius: 8,
                  marginBottom: 7,
                  backgroundColor:
                    draft.propertyId === property.id
                      ? theme.colors.selectedSurface
                      : theme.colors.surface,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textPrimary,
                    fontWeight:
                      draft.propertyId === property.id ? "600" : "400",
                  }}
                >
                  {property.address}
                </Text>
              </Pressable>
            ))}
            {(() => { const property = properties.find((item) => item.id === draft.propertyId); return property ? <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>Czynsz dla właściciela: {formatPlnAmount(property.ownerRent ?? "0")} · media: {property.mediaPaidByTenant ? "opłaca najemca" : "opłaca właściciel"}. Opodatkowana jest tylko część właściciela.</Text> : null; })()}
            {field("Otrzymana kwota (zł) *", "amount", {
              keyboardType: "decimal-pad",
              placeholder: "Wpisz faktycznie otrzymaną kwotę",
            })}
            <Pressable
              accessibilityRole="button"
              onPress={() => setTaxableExpanded((value) => !value)}
              style={{ paddingVertical: 8 }}
            >
              <Text style={action}>
                {taxableExpanded
                  ? "Ukryj kwotę podlegającą opodatkowaniu"
                  : "Ustaw kwotę podlegającą opodatkowaniu"}
              </Text>
            </Pressable>
            {taxableExpanded
              ? field("Kwota podlegająca opodatkowaniu (zł)", "taxableAmount", {
                  keyboardType: "decimal-pad",
                  placeholder: "Domyślnie kwota otrzymana",
                })
              : null}
            {field("Data otrzymania (RRRR-MM-DD) *", "receivedAt", {
              placeholder: "2026-09-26",
            })}
            {field("Miesiąc najmu (RRRR-MM)", "rentalMonth", {
              placeholder: "2026-09",
            })}
            {field("Opis", "description", {
              placeholder: "np. Częściowa wpłata za wrzesień",
            })}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void save()}
              style={[primaryButton, saving && { opacity: 0.6 }]}
            >
              <Text style={primaryText}>
                {saving
                  ? "Zapisywanie…"
                  : editing
                    ? "Zapisz zmiany"
                    : "Potwierdź wpłatę"}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const primaryButton = ui.primaryButton;
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
const summaryCard = { marginTop: 4, padding: 16 };
const summaryEyebrow = { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" as const };
const summaryAmount = { color: theme.colors.textPrimary, fontSize: 30, fontWeight: "700" as const, marginTop: 2 };
const rentStatusCard = { marginTop: 8, padding: 14 };
const rentStatusHeading = { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" as const, marginBottom: 6 };
const rentStatusRow = { borderTopWidth: 1, borderColor: theme.colors.divider, paddingVertical: 8 };
const rentPropertyName = { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" as const };
const rentDetailText = { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 };
const rentStatusTop = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8 };
const filterControl = { marginTop: 8, minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 8, paddingHorizontal: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12 };
const filterSelected = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const, flex: 1 };
const historyTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const, marginTop: 12, marginBottom: 2 };
const rangeHeader = { minHeight: 58, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 8, paddingHorizontal: 10, marginTop: 3, backgroundColor: theme.colors.surfaceMuted, borderRadius: 10 };
const rangeLabel = { color: theme.colors.textPrimary, fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.25 };
const monthHeader = { minHeight: 58, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.divider };
const monthLabel = { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.4 };
const monthTotal = { color: theme.colors.textPrimary, fontSize: 12, fontWeight: "600" as const, marginTop: 3 };
const monthChevron = { color: theme.colors.textSecondary, fontSize: 17, paddingHorizontal: 7 };
const emptyHistory = { paddingVertical: 20 };
const emptyText = { color: theme.colors.textSecondary, fontSize: 14 };
const filterBackdrop = { flex: 1, justifyContent: "flex-end" as const, backgroundColor: "rgba(0,0,0,0.35)" };
const filterSheet = { maxHeight: "75%" as const, paddingHorizontal: 20, paddingTop: 16, backgroundColor: theme.colors.background, borderTopLeftRadius: 18, borderTopRightRadius: 18 };
const sheetHeader = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingBottom: 12 };
const sheetTitle = { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" as const };
const filterOption = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderTopWidth: 1, borderColor: theme.colors.divider };
const optionMark = { width: 20, color: theme.colors.primary, fontSize: 16, fontWeight: "700" as const };
