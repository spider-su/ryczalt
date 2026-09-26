import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { createId, useRentalData } from "../data/RentalDataProvider";
import type { Property } from "../model/rental";
import { theme } from "../theme/theme";

type PropertyDraft = Omit<Property, "id">;
const blankDraft: PropertyDraft = {
  name: "",
  address: "",
  defaultMonthlyRent: "",
  tenantName: "",
  tenantPhone: "",
  tenantEmail: "",
  tenantSince: "",
  notes: "",
};

export function SettingsScreen() {
  const { document, error, update } = useRentalData();
  const [editing, setEditing] = useState<Property | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyDraft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const open = (property?: Property) => {
    setEditing(property ?? null);
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
    const property: Property = {
      id: editing?.id ?? createId("property"),
      name,
      ...optional("address", draft.address),
      ...(rent ? { defaultMonthlyRent: rent.replace(",", ".") } : {}),
      ...optional("tenantName", draft.tenantName),
      ...optional("tenantPhone", draft.tenantPhone),
      ...optional("tenantEmail", draft.tenantEmail),
      ...optional("tenantSince", draft.tenantSince),
      ...optional("notes", draft.notes),
    };
    setSaving(true);
    try {
      await update((current) => ({
        ...current,
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
    key: keyof PropertyDraft,
    options: {
      keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad";
      multiline?: boolean;
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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
          onPress={() => open()}
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
          <Text style={{ color: theme.colors.textSecondary, marginTop: 22 }}>
            Nie dodano jeszcze mieszkań.
          </Text>
        ) : (
          document.properties.map((property) => (
            <View
              key={property.id}
              style={{
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.divider,
              }}
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
                    onPress={() => open(property)}
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
              {property.tenantName ? (
                <Text style={muted}>Najemca: {property.tenantName}</Text>
              ) : null}
              {property.tenantPhone ? (
                <Text style={muted}>Telefon: {property.tenantPhone}</Text>
              ) : null}
              {property.tenantEmail ? (
                <Text style={muted}>E-mail: {property.tenantEmail}</Text>
              ) : null}
              {property.tenantSince ? (
                <Text style={muted}>Najem od: {property.tenantSince}</Text>
              ) : null}
              {property.notes ? (
                <Text style={{ ...muted, marginTop: 5 }}>{property.notes}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
              }}
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
            {field("Najem od (RRRR-MM-DD)", "tenantSince", {
              placeholder: "2026-09-01",
            })}
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
        </View>
      </Modal>
    </View>
  );
}

function optional(
  key:
    | "address"
    | "tenantName"
    | "tenantPhone"
    | "tenantEmail"
    | "tenantSince"
    | "notes",
  value?: string,
): Partial<Property> {
  const trimmed = value?.trim();
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
