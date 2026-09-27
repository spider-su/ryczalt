import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createId,
  todayIsoDate,
  useRentalData,
} from "../data/RentalDataProvider";
import type { IncomeEntry } from "../model/rental";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";
import { createIncomeEntry, editIncomeEntry } from "../domain/rentalOperations";
import { entriesForTaxYear } from "../domain/rentalHistory";
import { formatPln, moneyToGrosz } from "../domain/ryczaltTax";
import { summarizeRentMonth } from "../domain/reminders";
import { IncomeEntryRow } from "../components/income/IncomeEntryRow";
import { modalSafeAreaEdges } from "../navigation/safeAreaLayout";
import {
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
  const properties = document?.properties ?? [];
  const [selectedTaxYear, setSelectedTaxYear] = useState<number | null>(null);
  const rentalMonth = todayIsoDate().slice(0, 7);
  const configuredTaxYear =
    document?.settings.taxYear ?? new Date().getFullYear();
  const taxYear = selectedTaxYear ?? configuredTaxYear;
  const orderedEntries = useMemo(
    () => (document ? entriesForTaxYear(document.incomeEntries, taxYear) : []),
    [document, taxYear],
  );
  const annualIncomeGrosz = orderedEntries.reduce((total, entry) => total + moneyToGrosz(entry.amount), 0);
  useEffect(() => {
    const params = route.params as { propertyId?: string; rentalMonth?: string; quickAdd?: boolean; expectedAmount?: string } | undefined;
    const property = params?.propertyId ? properties.find((item) => item.id === params.propertyId) : undefined;
    if (params?.quickAdd) {
      const amount = params.expectedAmount ?? property?.defaultMonthlyRent ?? "";
      setEditing(null);
      setTaxableExpanded(false);
      setDraft({ ...blankDraft(), propertyId: property?.id ?? properties[0]?.id ?? "", amount,
        taxableAmount: amount, rentalMonth: params.rentalMonth ?? "" });
      setModalOpen(true);
      navigation.setParams({ quickAdd: undefined, expectedAmount: undefined, propertyId: undefined, rentalMonth: undefined });
      return;
    }
    if (!property || !params?.rentalMonth) return;
    setEditing(null);
    setTaxableExpanded(false);
    setDraft({ ...blankDraft(), propertyId: property.id, amount: property.defaultMonthlyRent ?? "", taxableAmount: property.defaultMonthlyRent ?? "", rentalMonth: params.rentalMonth });
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

  const openNew = (selectedPropertyId?: string, selectedRentalMonth = "") => {
    setEditing(null);
    setTaxableExpanded(false);
    setDraft({
      ...blankDraft(),
      propertyId: selectedPropertyId ?? properties[0]?.id ?? "",
      amount: properties.find((property) => property.id === selectedPropertyId)?.defaultMonthlyRent ?? (selectedPropertyId ? "" : properties[0]?.defaultMonthlyRent ?? ""),
      taxableAmount: properties.find((property) => property.id === selectedPropertyId)?.defaultMonthlyRent ?? (selectedPropertyId ? "" : properties[0]?.defaultMonthlyRent ?? ""),
      rentalMonth: selectedRentalMonth,
    });
    setModalOpen(true);
  };
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
      amount: current.amount || property?.defaultMonthlyRent || "",
      taxableAmount:
        current.taxableAmount || property?.defaultMonthlyRent || "",
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
    const taxableAmount = (taxableExpanded ? draft.taxableAmount : amount)
      .trim()
      .replace(",", ".");
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
  const remove = (entry: IncomeEntry) => {
    if (deletingId) return;
    Alert.alert(
      "Usunąć wpłatę?",
      `Wpłata ${entry.amount} zł z dnia ${entry.receivedAt} zostanie usunięta.`,
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
    <View style={{ ...ui.page, paddingTop: 18 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: 26,
            fontWeight: "700",
            marginTop: 8,
          }}
        >
          Przychód
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Text style={{ color: theme.colors.textSecondary }}>Rok:</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedTaxYear(taxYear - 1)}
          >
            <Text style={action}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>
            {taxYear}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedTaxYear(taxYear + 1)}
          >
            <Text style={action}>›</Text>
          </Pressable>
          {taxYear !== configuredTaxYear ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedTaxYear(null)}
            >
              <Text style={action}>Bieżący</Text>
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.danger, marginTop: 8 }}
          >
            {error}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={orderedEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View>
            <View style={ui.card}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Roczna ewidencja wpływów · {taxYear}</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 30, fontWeight: "700", marginTop: 8 }}>{formatPln(annualIncomeGrosz)}</Text>
            </View>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 4 }}>Czynsz do potwierdzenia · {rentalMonth}</Text>
            {properties.map((property) => {
              const summary = summarizeRentMonth(property, document.incomeEntries, rentalMonth);
              return <View key={property.id} style={ui.card}>
                <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{property.name} · {rentalMonth}</Text>
                {summary.status === "unknown" ? <Text style={muted}>Oczekiwany czynsz nieustalony</Text> : <>
                  <Text style={muted}>Oczekiwano {formatPln(summary.expectedGrosz)}</Text>
                  <Text style={muted}>Potwierdzono {formatPln(summary.confirmedGrosz)}</Text>
                  {summary.status === "complete" ? <Text style={muted}>Wpłata potwierdzona</Text> : <Text style={muted}>Pozostało do potwierdzenia {formatPln(summary.remainingGrosz)}</Text>}
                </>}
                {summary.unallocatedGrosz > 0 ? <Text style={muted}>Nadwyżka ponad prognozowane czynsze: {formatPln(summary.unallocatedGrosz)}</Text> : null}
                <Pressable accessibilityRole="button" onPress={() => openNew(property.id, rentalMonth)}><Text style={action}>Sprawdź wpłatę</Text></Pressable>
              </View>;
            })}
            <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 4 }}>Potwierdzone wpłaty</Text>
            <Pressable accessibilityRole="button" onPress={() => openNew()} style={primaryButton}><Text style={primaryText}>＋ Potwierdź otrzymaną wpłatę</Text></Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={{ ...ui.emptyState, marginTop: 18 }}>
            <Text style={{ color: theme.colors.textSecondary }}>{properties.length
              ? "Brak potwierdzonych wpłat."
              : "Dodaj mieszkanie w zakładce Ustawienia, aby zapisać wpłatę."}</Text>
          </View>
        }
        renderItem={({ item }) => <IncomeEntryRow
          entry={item}
          propertyName={properties.find((property) => property.id === item.propertyId)?.name ?? "Usunięte mieszkanie"}
          onEdit={() => openEdit(item)}
          onRemove={() => remove(item)}
        />}
      />
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={modalSafeAreaEdges}>
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
              {editing ? "Popraw wpłatę" : "Potwierdź wpłatę"}
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
                      ? theme.colors.primary
                      : theme.colors.inputBorder,
                  borderRadius: 8,
                  marginBottom: 7,
                  backgroundColor:
                    draft.propertyId === property.id
                      ? theme.colors.accentSoft
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
                  {property.name}
                </Text>
              </Pressable>
            ))}
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
                    ? "Zapisz poprawki"
                    : "Potwierdź otrzymanie wpłaty"}
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
