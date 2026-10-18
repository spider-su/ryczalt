import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { FormButton, FormField } from "../FormControls";
import { todayIsoDate } from "../../data/RentalDataProvider";
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(draft.rentalStartDate ?? todayIsoDate()));
  const { width, height } = useWindowDimensions();
  const wideScreen = width >= 760;

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
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: wideScreen ? 36 : 20, paddingTop: 24, paddingBottom: 30 }}>
      <View style={{ width: "100%", maxWidth: 760, alignSelf: "center", flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: theme.colors.primary, letterSpacing: 0.8, marginBottom: 10 }}>
          PIERWSZY NAJEM · KROK {step + 1} Z 3
        </Text>
        <View accessibilityLabel={`Postęp konfiguracji: krok ${step + 1} z 3`} style={{ flexDirection: "row", gap: 6, marginBottom: 18 }}>
          {stepTitles.map((title, index) => (
            <View key={title} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: index <= step ? theme.colors.primary : theme.colors.borderSubtle }} />
          ))}
        </View>
        {step !== 0 ? <>
          <Text style={{ fontSize: 25, fontWeight: "700", color: theme.colors.textPrimary }}>{stepTitles[step]}</Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 21, marginTop: 6, marginBottom: 10 }}>{stepDescriptions[step]}</Text>
        </> : null}

      {step === 0 ? (
        <View style={{ flex: 1, justifyContent: height > 760 ? "center" : "flex-start", gap: 18, paddingVertical: 8 }}>
          <View style={{ backgroundColor: theme.colors.accentSoft, borderRadius: 24, padding: wideScreen ? 30 : 22, borderWidth: 1, borderColor: "#F6D4DC", gap: 16 }}>
            <View style={{ width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface }}>
              <MaterialIcons name="home" size={32} color={theme.colors.primary} />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 }}>DOBRZE, ŻE ZACZYNASZ</Text>
              <Text style={{ color: theme.colors.textPrimary, fontSize: wideScreen ? 32 : 28, lineHeight: wideScreen ? 38 : 34, fontWeight: "800", maxWidth: 560 }}>
                Dodajmy Twoje pierwsze mieszkanie
              </Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 16, lineHeight: 24, maxWidth: 590 }}>
                Zajmie to tylko chwilę. Ustawimy najem, a potem łatwiej sprawdzisz czynsz i podatek w jednym miejscu.
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
              {["3 krótkie kroki", "Możesz zmienić dane później", "Dane zostają na Twoim urządzeniu"].map((item) => (
                <View key={item} style={{ backgroundColor: theme.colors.surface, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[ui.card, { padding: wideScreen ? 24 : 18, gap: 18 }]}>
            <View style={{ gap: 5, marginBottom: 2 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" }}>Zacznij od podstaw</Text>
              <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>Resztę ustawień możesz uzupełnić później.</Text>
            </View>
            <FormField
              label="Adres mieszkania *"
              value={draft.address}
              onChangeText={(address) => setField({ address })}
              placeholder="np. ul. Parkowa 12/4"
            />
            <View style={{ gap: 6 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>Najem rozpoczął się *</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Wybierz datę rozpoczęcia najmu${draft.rentalStartDate ? `, ${formatStartDate(draft.rentalStartDate)}` : ""}`} accessibilityHint="Otwiera kalendarz" onPress={() => { setCalendarMonth(monthStart(draft.rentalStartDate ?? todayIsoDate())); setDatePickerOpen(true); }} style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: error.includes("datę rozpoczęcia") ? theme.colors.danger : theme.colors.inputBorder, paddingHorizontal: 12, backgroundColor: theme.colors.inputBackground, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: draft.rentalStartDate ? theme.colors.textPrimary : theme.colors.textMuted }}>{draft.rentalStartDate ? formatStartDate(draft.rentalStartDate) : "Wybierz datę"}</Text>
                <MaterialIcons name="calendar-today" size={20} color={theme.colors.textSecondary} />
              </Pressable>
              {error.includes("datę rozpoczęcia") ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
            </View>
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
              <Text style={{ color: theme.colors.textPrimary, flex: 1 }}>Najemca płaci media / opłaty</Text>
              <Switch
                accessibilityLabel="Najemca płaci media / opłaty"
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
              {"\n"}Czynsz: {draft.ownerRent.trim()} zł · Media: {draft.mediaAmount.trim() || "0"} zł
              {"\n"}Dzień płatności: {draft.paymentDay.trim()}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={{ fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary }}>
        Data najmu jest wstępnie ustawiona na 1 stycznia bieżącego roku. Przy dodawaniu mieszkania możesz potwierdzić wcześniejsze czynsze i podatek za te okresy.
      </Text>
      {error && !error.includes("datę rozpoczęcia") ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
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
      <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(21,34,56,0.45)", justifyContent: "center", padding: 20 }}>
          <View style={{ alignSelf: "center", width: "100%", maxWidth: 380, borderRadius: 18, padding: 18, backgroundColor: theme.colors.surface, gap: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc" onPress={() => setCalendarMonth((month) => shiftMonth(month, -1))} style={{ padding: 8 }}><MaterialIcons name="chevron-left" size={26} color={theme.colors.primary} /></Pressable>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700", textTransform: "capitalize" }}>{new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(`${calendarMonth}-01T12:00:00`))}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Następny miesiąc" onPress={() => setCalendarMonth((month) => shiftMonth(month, 1))} style={{ padding: 8 }}><MaterialIcons name="chevron-right" size={26} color={theme.colors.primary} /></Pressable>
            </View>
            <View style={{ flexDirection: "row" }}>{["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => <Text key={day} style={{ flex: 1, textAlign: "center", color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600", paddingVertical: 6 }}>{day}</Text>)}</View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarDays(calendarMonth).map((day, index) => {
                const value = day ? dateInMonth(calendarMonth, day) : "";
                const selected = value !== "" && value === draft.rentalStartDate;
                return <Pressable key={`${calendarMonth}-${index}`} accessibilityRole={day ? "button" : undefined} accessibilityLabel={day ? formatStartDate(value) : undefined} accessibilityState={day ? { selected } : undefined} disabled={!day} onPress={() => { setField({ rentalStartDate: value }); setDatePickerOpen(false); }} style={{ width: "14.2857%", height: 42, alignItems: "center", justifyContent: "center" }}>
                  {day ? <Text style={{ width: 34, height: 34, lineHeight: 34, textAlign: "center", overflow: "hidden", borderRadius: 17, backgroundColor: selected ? theme.colors.primary : "transparent", color: selected ? theme.colors.onAccent : theme.colors.textPrimary, fontWeight: selected ? "700" : "500" }}>{day}</Text> : null}
                </Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setDatePickerOpen(false)} style={{ alignSelf: "flex-end", padding: 8 }}><Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Anuluj</Text></Pressable>
          </View>
        </View>
      </Modal>
      </View>
    </ScrollView>
  );
}

function monthStart(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}` : todayIsoDate().slice(0, 7);
}

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year!, month! - 1 + amount, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calendarDays(value: string): Array<number | null> {
  const [year, month] = value.split("-").map(Number);
  const firstDayOffset = (new Date(year!, month! - 1, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year!, month!, 0, 12).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

function dateInMonth(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function formatStartDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}
