import { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRentalData } from "../data/RentalDataProvider";
import type { RentalDocument } from "../model/rental";
import { PeriodSelector } from "../components/PeriodSelector";
import { hasTaxRulesForYear } from "../domain/ryczaltTax";
import { isNonnegativeMoney } from "../domain/rentalValidation";
import { SETTINGS_TAX_LEGAL_DEFAULT_OPEN } from "../domain/settingsPresentation";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";

/** Calculation rules only. Payment recipient and micro-account remain in general Settings. */
export function TaxCalculationSettings() {
  const { document, update } = useRentalData();
  const [taxEligibilityOpen, setTaxEligibilityOpen] = useState(SETTINGS_TAX_LEGAL_DEFAULT_OPEN);
  const [taxAdvancedOpen, setTaxAdvancedOpen] = useState(false);
  const [openingRevenueDraft, setOpeningRevenueDraft] = useState("");
  const [openingTaxPaidDraft, setOpeningTaxPaidDraft] = useState("");
  useEffect(() => {
    setOpeningRevenueDraft(document?.settings.openingTaxableRevenue ?? "");
    setOpeningTaxPaidDraft(document?.settings.openingTaxPaid ?? "");
  }, [document?.settings.openingTaxableRevenue, document?.settings.openingTaxPaid]);
  if (!document) return null;
  const hasAnyTaxSnapshots = Boolean(document.taxSettlementSnapshots?.length);
  const updateTaxSettings = (change: (settings: RentalDocument["settings"]) => RentalDocument["settings"]) => {
    void update((current) => ({ ...current, settings: change(current.settings) })).catch(() => {
      Alert.alert("Nie zapisano ustawień", "Spróbuj ponownie.");
    });
  };
  const saveOpeningBalances = () => {
    if (document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)) {
      Alert.alert("Rok ma zamknięte okresy", "Stan początkowy jest częścią zapisanych rozliczeń. Nie można go zmienić po zamknięciu miesiąca.");
      return;
    }
    const revenue = openingRevenueDraft.trim().replace(",", ".");
    const paid = openingTaxPaidDraft.trim().replace(",", ".");
    if ((revenue && !isNonnegativeMoney(revenue)) || (paid && !isNonnegativeMoney(paid))) {
      Alert.alert("Nieprawidłowa kwota", "Wpisz kwoty równe lub większe od zera.");
      return;
    }
    updateTaxSettings((settings) => ({ ...settings, openingTaxableRevenue: revenue || undefined, openingTaxPaid: paid || undefined }));
  };
  return <View>
    <Text style={{ color: theme.colors.textSecondary, marginBottom: 12, fontSize: 14 }}>Stawki ryczałtu: 8,5% do progu i 12,5% powyżej progu. Stawki wynikają z reguł podatkowych, nie są edytowalne.</Text>
        <PeriodSelector value={String(document.settings.taxYear)} valueLabel={`Rok podatkowy ${document.settings.taxYear}`} previousLabel="Poprzedni rok podatkowy" nextLabel="Następny rok podatkowy"
          previousDisabled={document.settings.taxYear <= 2025} nextDisabled={document.settings.taxYear >= new Date().getFullYear()}
          onPrevious={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear - 1 }))}
          onNext={() => updateTaxSettings((settings) => ({ ...settings, taxYear: settings.taxYear + 1 }))} />
        {!hasTaxRulesForYear(document.settings.taxYear) ? <Text accessibilityRole="alert" style={{ color: theme.colors.warning, marginTop: 8 }}>Możesz wybrać ten rok kalendarzowy, ale reguły podatkowe nie są jeszcze zweryfikowane i wyliczenie pozostanie niedostępne.</Text> : null}
        <Text style={sectionTitle}>Próg podatkowy</Text>
        <View style={notificationRow}><Text style={{ ...rowTitle, flex: 1 }}>Limit 200 000 zł dla małżonków</Text><Switch disabled={hasAnyTaxSnapshots} value={document.settings.jointSpouseThreshold} onValueChange={(enabled) => {
          if (!enabled) { updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: false })); return; }
          Alert.alert("Limit dla małżonków", "Wyższy limit 200 000 zł stosuj wyłącznie, jeśli spełniasz warunki wspólności majątkowej i opodatkowania całości przychodów przez jednego małżonka.", [
            { text: "Anuluj", style: "cancel" }, { text: "Potwierdzam", onPress: () => updateTaxSettings((settings) => ({ ...settings, jointSpouseThreshold: true })) },
          ]);
        }} trackColor={{ false: theme.colors.borderSubtle, true: theme.colors.selectedNavigation }} thumbColor={theme.colors.surface} accessibilityLabel="Limit 200 000 zł dla małżonków" accessibilityState={{ checked: document.settings.jointSpouseThreshold, disabled: hasAnyTaxSnapshots }} /></View>
        {hasAnyTaxSnapshots ? <Text style={muted}>Limit progu jest zablokowany po zapisaniu rozliczeń, aby nie zmienić pozostałych okresów roku.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: taxEligibilityOpen }} onPress={() => setTaxEligibilityOpen((open) => !open)} style={disclosureRow}><Text style={disclosureTitle}>ⓘ Kiedy mogę użyć tego limitu? {taxEligibilityOpen ? "⌃" : "›"}</Text></Pressable>
        {taxEligibilityOpen ? <Text style={legalText}>Wyższy limit 200 000 zł stosuj wyłącznie przy wspólności majątkowej i wyborze opodatkowania całości przychodów z najmu przez jednego małżonka, po złożeniu wymaganego oświadczenia w terminie.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: taxAdvancedOpen }} onPress={() => setTaxAdvancedOpen((open) => !open)} style={[disclosureRow, { marginTop: 18 }]}>
          <View style={{ flex: 1 }}><Text style={disclosureTitle}>Dane początkowe</Text><Text style={muted}>Tylko jeśli zaczynasz śledzenie w trakcie roku.</Text></View>
          <MaterialIcons name={taxAdvancedOpen ? "expand-less" : "expand-more"} size={22} color={theme.colors.textSecondary} />
        </Pressable>
        {taxAdvancedOpen ? <View style={[ui.compactCard, { marginTop: 4 }]}>
          <Text style={muted}>Wpisz łączny przychód i podatek sprzed rozpoczęcia śledzenia w {document.settings.taxYear}. Kwoty wpływają na roczny próg bez przypisywania różnicy do nieznanego miesiąca.</Text>
          <Text style={fieldLabel}>Przychód otrzymany wcześniej w tym roku</Text>
          <TextInput editable={!document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} accessibilityLabel="Przychód otrzymany wcześniej w tym roku" keyboardType="decimal-pad" value={openingRevenueDraft} onChangeText={setOpeningRevenueDraft} placeholder="np. 0" placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
          <Text style={fieldLabel}>Podatek zapłacony wcześniej w tym roku</Text>
          <TextInput editable={!document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} accessibilityLabel="Podatek zapłacony wcześniej w tym roku" keyboardType="decimal-pad" value={openingTaxPaidDraft} onChangeText={setOpeningTaxPaidDraft} placeholder="np. 0" placeholderTextColor={theme.colors.textMuted} style={inputStyle} />
          <Pressable accessibilityRole="button" disabled={document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear)} onPress={saveOpeningBalances} style={[secondaryButton, document.taxSettlementSnapshots?.some((snapshot) => snapshot.rulesYear === document.settings.taxYear) && disabledControl]}><Text style={modeText}>Zapisz dane początkowe</Text></Pressable>
        </View> : null}

  </View>;
}

const sectionTitle = ui.sectionTitle;
const notificationRow = { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const rowTitle = { color: theme.colors.textPrimary, fontWeight: "600" as const, fontSize: 16 };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const disclosureRow = { minHeight: 44, justifyContent: "center" as const, marginTop: 4 };
const disclosureTitle = { color: theme.colors.primary, fontSize: 14, fontWeight: "600" as const };
const legalText = { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, paddingBottom: 8 };
const fieldLabel = { ...ui.fieldLabel, marginTop: 12 };
const inputStyle = { ...ui.input, paddingVertical: 10 };
const secondaryButton = { ...ui.secondaryButton, marginVertical: 8 };
const modeText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const disabledControl = { opacity: 0.45 };
