import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Property, PropertyLink } from "../../model/rental";
import { theme } from "../../theme/theme";
import { AGREEMENT_REMINDER_DAYS } from "../../domain/rentalValidation";

export type PropertyDraft = Omit<Property, "id" | "expectedPaymentDay" | "paymentReminderEnabled" | "paymentReminderDelayDays" | "rentalEndReminderDays"> & {
  expectedPaymentDay: string;
  paymentReminderEnabled: boolean;
  paymentReminderDelayDays: string;
  rentalEndReminderDays: number[];
};

export const blankPropertyDraft: PropertyDraft = {
  name: "", address: "", defaultMonthlyRent: "", tenantName: "", tenantPhone: "", tenantEmail: "", tenantSince: "",
  rentalEndDate: "", rentalEndReminderDays: [30, 7], expectedPaymentDay: "", paymentReminderEnabled: false,
  paymentReminderDelayDays: "1", administratorName: "", administratorPortalUrl: "", administratorPhone: "", administratorEmail: "", notes: "",
};

type PropertyField = "name" | "address" | "defaultMonthlyRent" | "tenantName" | "tenantPhone" | "tenantEmail" | "rentalEndDate" | "administratorName" | "administratorPortalUrl" | "administratorPhone" | "administratorEmail" | "notes";
type Props = {
  visible: boolean;
  editing: Property | null;
  draft: PropertyDraft;
  setDraft: Dispatch<SetStateAction<PropertyDraft>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  linkDrafts: PropertyLink[];
  setLinkDrafts: Dispatch<SetStateAction<PropertyLink[]>>;
  linkLabel: string;
  setLinkLabel: (value: string) => void;
  linkUrl: string;
  setLinkUrl: (value: string) => void;
  linkCategory: PropertyLink["category"];
  setLinkCategory: (value: PropertyLink["category"]) => void;
  onAddLink: () => void;
  focusField?: string;
  onFocusHandled?: () => void;
};

export function PropertyEditorModal(props: Props) {
  const { visible, editing, draft, setDraft } = props;
  const scrollRef = useRef<ScrollView>(null);
  const focusLayout = (key: string) => props.focusField === key ? (event: any) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
    props.onFocusHandled?.();
  } : undefined;
  const field = (label: string, key: PropertyField, options: { keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad"; multiline?: boolean; placeholder?: string } = {}) => <View style={{ marginBottom: 14 }} key={key} onLayout={focusLayout(key)}>
    <Text style={fieldCaption}>{label}</Text>
    <TextInput accessibilityLabel={label} value={draft[key] ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
      placeholder={options.placeholder} placeholderTextColor={theme.colors.textMuted} keyboardType={options.keyboardType ?? "default"} multiline={options.multiline}
      style={[inputStyle, { textAlignVertical: options.multiline ? "top" : "center" }, options.multiline && { minHeight: 84 }]} />
  </View>;

  return <Modal visible={visible} animationType="slide" onRequestClose={props.onClose}>
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={modalHeader}><Text style={modalTitle}>{editing ? "Edytuj mieszkanie" : "Nowe mieszkanie"}</Text><Pressable accessibilityRole="button" onPress={props.onClose}><Text style={action}>Zamknij</Text></Pressable></View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        {field("Nazwa mieszkania *", "name", { placeholder: "np. Mieszkanie przy Parkowej" })}
        {field("Adres", "address")}
        {field("Domyślny czynsz miesięczny (zł)", "defaultMonthlyRent", { keyboardType: "decimal-pad", placeholder: "np. 2500,00" })}
        {field("Imię i nazwisko najemcy", "tenantName")}
        {field("Telefon", "tenantPhone", { keyboardType: "phone-pad" })}
        {field("E-mail", "tenantEmail", { keyboardType: "email-address" })}
        {field("Umowa najmu do (RRRR-MM-DD)", "rentalEndDate", { placeholder: "2026-12-31" })}
        <Text style={fieldLabel}>Przypomnij przed końcem umowy</Text>
        <View style={choiceRow}>{AGREEMENT_REMINDER_DAYS.map((days) => {
          const selected = draft.rentalEndReminderDays.includes(days);
          return <Pressable key={days} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setDraft((current) => ({ ...current, rentalEndReminderDays: selected ? current.rentalEndReminderDays.filter((item) => item !== days) : [...current.rentalEndReminderDays, days].sort((a, b) => b - a) }))} style={[modeButton, selected && selectedMode]}><Text style={modeText}>{days === 0 ? "W dniu umowy" : `${days} dni`}</Text></Pressable>;
        })}</View>
        <Text style={sectionTitle}>Przypomnienie o czynszu</Text>
        <View onLayout={focusLayout("expectedPaymentDay")}>
          <Text style={fieldLabel}>Oczekiwany dzień płatności (1–31)</Text>
          <TextInput accessibilityLabel="Oczekiwany dzień płatności" value={draft.expectedPaymentDay} onChangeText={(value) => setDraft((current) => ({ ...current, expectedPaymentDay: value }))} keyboardType="number-pad" placeholder="np. 10" style={inputStyle} />
        </View>
        <View onLayout={focusLayout("paymentReminderEnabled")}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.paymentReminderEnabled }} onPress={() => setDraft((current) => ({ ...current, paymentReminderEnabled: !current.paymentReminderEnabled }))} style={{ paddingVertical: 10 }}><Text style={muted}>{draft.paymentReminderEnabled ? "☑" : "□"} Przypominaj, aby sprawdzić wpłatę</Text></Pressable>
        </View>
        {draft.paymentReminderEnabled ? <><Text style={fieldLabel}>Dni po oczekiwanym terminie (0–30)</Text><TextInput accessibilityLabel="Opóźnienie przypomnienia o czynszu" value={draft.paymentReminderDelayDays} onChangeText={(value) => setDraft((current) => ({ ...current, paymentReminderDelayDays: value }))} keyboardType="number-pad" placeholder="1" style={inputStyle} /></> : null}
        <Text style={sectionTitle}>Administracja</Text>
        {field("Nazwa administratora", "administratorName")}
        {field("Adres panelu administracji (HTTPS)", "administratorPortalUrl", { placeholder: "https://" })}
        {field("Telefon administracji", "administratorPhone", { keyboardType: "phone-pad" })}
        {field("E-mail administracji", "administratorEmail", { keyboardType: "email-address" })}
        <Text style={sectionTitle}>Przydatne linki</Text><Text style={muted}>Linki otwierają się w przeglądarce. Nie zapisuj tu haseł.</Text>
        <TextInput accessibilityLabel="Nazwa przydatnego linku" value={props.linkLabel} onChangeText={props.setLinkLabel} placeholder="np. Dostawca prądu" style={inputStyle} />
        <TextInput accessibilityLabel="Adres przydatnego linku HTTPS" value={props.linkUrl} onChangeText={props.setLinkUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" style={inputStyle} />
        <View style={choiceRow}>{([ ["ADMINISTRATION", "Administracja"], ["UTILITY", "Media"], ["TAX", "Podatki"], ["OTHER", "Inne"] ] as const).map(([category, label]) => <Pressable key={category} accessibilityRole="radio" accessibilityState={{ checked: props.linkCategory === category }} onPress={() => props.setLinkCategory(category)} style={[modeButton, props.linkCategory === category && selectedMode]}><Text style={modeText}>{label}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" onPress={props.onAddLink} style={secondaryButton}><Text style={modeText}>Dodaj link</Text></Pressable>
        {props.linkDrafts.map((link) => <View key={link.id} style={linkRow}><View style={{ flex: 1 }}><Text style={fieldLabel}>{link.label}</Text><Text style={muted}>{link.url}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Usuń link ${link.label}`} onPress={() => props.setLinkDrafts((current) => current.filter((item) => item.id !== link.id))}><Text style={dangerAction}>Usuń</Text></Pressable></View>)}
        {field("Notatki", "notes", { multiline: true })}
        <Pressable accessibilityRole="button" disabled={props.saving} onPress={props.onSave} style={[primaryButton, props.saving && { opacity: 0.6 }]}><Text style={primaryText}>{props.saving ? "Zapisywanie…" : "Zapisz mieszkanie"}</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const fieldLabel = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 6 };
const fieldCaption = { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6 };
const inputStyle = { color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 };
const modeButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 };
const selectedMode = { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentSoft };
const modeText = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const choiceRow = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: 12 };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const, marginTop: 22, marginBottom: 8 };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const dangerAction = { ...action, color: theme.colors.danger };
const linkRow = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const modalHeader = { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const };
const modalTitle = { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" as const };
const secondaryButton = { borderWidth: 1, borderColor: theme.colors.inputBorder, minHeight: 44, borderRadius: 8, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 14, marginVertical: 8 };
const primaryButton = { backgroundColor: theme.colors.primary, minHeight: 48, borderRadius: 8, justifyContent: "center" as const, alignItems: "center" as const, paddingHorizontal: 16, marginVertical: 8 };
const primaryText = { color: theme.colors.onAccent, fontWeight: "700" as const, fontSize: 15 };
