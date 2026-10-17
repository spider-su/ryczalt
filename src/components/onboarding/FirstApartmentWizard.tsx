import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { FormButton, FormField } from "../FormControls";
import {
  canCompleteFirstApartment,
  firstApartmentStepError,
  type FirstApartmentDraft,
  type FirstApartmentStep,
} from "../../domain/firstApartmentOnboarding";
import { theme } from "../../theme/theme";
import { ui } from "../../theme/ui";

type Props = {
  draft: FirstApartmentDraft;
  onChange: (changes: Partial<FirstApartmentDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
};

const stepTitles = ["Mieszkanie", "Płatności", "Podatek i gotowe"] as const;
const stepDescriptions = [
  "Zacznij od adresu i daty rozpoczęcia najmu. Dane najemcy możesz dodać teraz albo później.",
  "Oddziel czynsz właściciela od opłat i określ termin wpłaty.",
  "Sprawdź dane i wybierz, co zgodnie z umową wlicza się do przychodu.",
] as const;

export function FirstApartmentWizard({ draft, onChange, onSave, onCancel, saving }: Props) {
  const [step, setStep] = useState<FirstApartmentStep>(0);
  const [error, setError] = useState("");

  const advance = () => {
    const issue = firstApartmentStepError(draft, step);
    if (issue) { setError(issue); return; }
    setError("");
    if (step < 2) { setStep((step + 1) as FirstApartmentStep); return; }
    if (!canCompleteFirstApartment(draft)) {
      for (const index of [0, 1, 2] as FirstApartmentStep[]) {
        const missing = firstApartmentStepError(draft, index);
        if (missing) { setStep(index); setError(missing); return; }
      }
    }
    onSave();
  };

  const setField = (changes: Partial<FirstApartmentDraft>) => {
    onChange(changes);
    setError("");
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 38, gap: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: theme.colors.primary }}>
        PIERWSZY NAJEM · KROK {step + 1} Z 3
      </Text>
      <View accessibilityLabel={`Postęp konfiguracji: krok ${step + 1} z 3`} style={{ flexDirection: "row", gap: 6 }}>
        {stepTitles.map((title, index) => (
          <View key={title} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: index <= step ? theme.colors.primary : theme.colors.borderSubtle }} />
        ))}
      </View>
      <Text style={{ fontSize: 25, fontWeight: "700", color: theme.colors.textPrimary }}>{stepTitles[step]}</Text>
      <Text style={{ color: theme.colors.textSecondary, lineHeight: 21 }}>{stepDescriptions[step]}</Text>

      {step === 0 ? (
        <View style={ui.card}>
          <View style={{ gap: 16 }}>
            <FormField
              label="Adres mieszkania *"
              value={draft.address}
              onChangeText={(address) => setField({ address })}
              placeholder="np. ul. Parkowa 12/4"
            />
            <FormField
              label="Najem od *"
              value={draft.rentalStartDate}
              onChangeText={(rentalStartDate) => setField({ rentalStartDate })}
              keyboardType="number-pad"
              placeholder="RRRR-MM-DD"
            />
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: -8 }}>
              Domyślnie 1 stycznia bieżącego roku. Możesz zmienić datę zgodnie z rzeczywistym początkiem najmu.
            </Text>
            <FormField
              label="Najemca (opcjonalnie)"
              value={draft.tenantName}
              onChangeText={(tenantName) => setField({ tenantName })}
              placeholder="Imię i nazwisko"
            />
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={ui.card}>
          <View style={{ gap: 16 }}>
            <FormField
              label="Czynsz dla właściciela (zł) *"
              value={draft.ownerRent}
              onChangeText={(ownerRent) => setField({ ownerRent })}
              keyboardType="decimal-pad"
              placeholder="np. 2500"
            />
            <FormField
              label="Media / opłaty (zł/mies.)"
              value={draft.mediaAmount}
              onChangeText={(mediaAmount) => setField({ mediaAmount })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: theme.colors.textPrimary, flex: 1 }}>Media płaci najemca</Text>
              <Switch
                accessibilityLabel="Media płaci najemca"
                accessibilityState={{ checked: Boolean(draft.mediaPaidByTenant) }}
                value={Boolean(draft.mediaPaidByTenant)}
                onValueChange={(mediaPaidByTenant) => setField({ mediaPaidByTenant })}
              />
            </View>
            <FormField
              label="Dzień płatności (1–31) *"
              value={draft.paymentDay}
              onChangeText={(paymentDay) => setField({ paymentDay })}
              keyboardType="number-pad"
              placeholder="np. 5"
            />
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <>
          <View style={ui.card}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              Co wliczać do przychodu opodatkowanego?
            </Text>
            <Text style={{ color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 12 }}>
              To zależy od umowy najmu. Nie wybieramy tego automatycznie na podstawie opłat.
            </Text>
            {([
              ["OWNER_RENT", "Tylko czynsz dla właściciela"],
              ["RENT_AND_CHARGES", "Czynsz i opłaty dodatkowe"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.taxableTreatment === value }}
                onPress={() => setField({ taxableTreatment: value })}
                style={{
                  paddingVertical: 15, paddingHorizontal: 12, marginBottom: 8,
                  borderWidth: 1, borderRadius: 12,
                  borderColor: draft.taxableTreatment === value ? theme.colors.primary : theme.colors.borderSubtle,
                  backgroundColor: draft.taxableTreatment === value ? theme.colors.accentSoft : theme.colors.surface,
                }}
              >
                <Text style={{ color: theme.colors.textPrimary, fontWeight: draft.taxableTreatment === value ? "700" : "500" }}>
                  {draft.taxableTreatment === value ? "◉ " : "○ "}{label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={ui.card}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "700", marginBottom: 6 }}>Podsumowanie</Text>
            <Text style={{ color: theme.colors.textSecondary, lineHeight: 22 }}>
              {draft.address.trim()}{draft.tenantName.trim() ? ` · ${draft.tenantName.trim()}` : ""}
              {"\n"}Najem od: {draft.rentalStartDate.trim()}
              {"\n"}Czynsz: {draft.ownerRent.trim()} zł · Media: {draft.mediaAmount.trim() || "0"} zł
              {"\n"}Dzień płatności: {draft.paymentDay.trim()}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={{ fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary }}>
        Zakończone miesiące od daty rozpoczęcia najmu do poprzedniego miesiąca zostaną dodane jako potwierdzone wpłaty początkowe, a wyliczony za nie podatek jako zapłacony. Bieżący miesiąc potwierdzasz ręcznie.
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <FormButton label={step === 2 ? "Zapisz mieszkanie" : "Dalej"} onPress={advance} busy={saving} disabled={saving} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={step > 0 ? () => { setStep((step - 1) as FirstApartmentStep); setError(""); } : onCancel} style={{ padding: 12 }}>
          <Text style={{ color: theme.colors.textSecondary, fontWeight: "600" }}>{step > 0 ? "Wstecz" : "Pomiń na razie"}</Text>
        </Pressable>
        {step > 0 ? (
          <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={{ padding: 12 }}>
            <Text style={{ color: theme.colors.textSecondary }}>Zamknij</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
