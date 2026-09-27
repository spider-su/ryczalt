import { Pressable, Text, View } from "react-native";
import type { Property } from "../../model/rental";
import { theme } from "../../theme/theme";

export function PropertyList({ properties, onEdit, onRemove, onOpenPortal }: {
  properties: Property[];
  onEdit: (property: Property) => void;
  onRemove: (property: Property) => void;
  onOpenPortal: (property: Property) => void;
}) {
  if (!properties.length) return <Text style={{ color: theme.colors.textSecondary, marginTop: 22 }}>Nie dodano jeszcze mieszkań.</Text>;
  return <>{properties.map((property) => <View key={property.id} style={propertyRow}>
    <View style={propertyHeader}>
      <View style={{ flex: 1 }}><Text style={propertyName}>{property.name}</Text>{property.address ? <Text style={muted}>{property.address}</Text> : null}</View>
      <View style={propertyActions}>
        <Pressable accessibilityRole="button" onPress={() => onEdit(property)}><Text style={action}>Edytuj</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => onRemove(property)}><Text style={dangerAction}>Usuń</Text></Pressable>
      </View>
    </View>
    {property.defaultMonthlyRent ? <Text style={muted}>Domyślny czynsz: {property.defaultMonthlyRent} zł / mies.</Text> : null}
    {property.expectedPaymentDay ? <Text style={muted}>Oczekiwany czynsz: {property.expectedPaymentDay}. dzień miesiąca</Text> : null}
    {property.paymentReminderEnabled ? <Text style={muted}>Przypomnienie: {property.paymentReminderDelayDays ?? 1} dni po terminie</Text> : null}
    {property.tenantName ? <Text style={muted}>Najemca: {property.tenantName}</Text> : null}
    {property.tenantPhone ? <Text style={muted}>Telefon: {property.tenantPhone}</Text> : null}
    {property.tenantEmail ? <Text style={muted}>E-mail: {property.tenantEmail}</Text> : null}
    {property.rentalEndDate ? <Text style={muted}>Umowa do: {property.rentalEndDate}</Text> : null}
    {property.administratorName ? <Text style={muted}>Administracja: {property.administratorName}</Text> : null}
    {property.administratorPhone ? <Text style={muted}>Telefon administracji: {property.administratorPhone}</Text> : null}
    {property.administratorEmail ? <Text style={muted}>E-mail administracji: {property.administratorEmail}</Text> : null}
    {property.administratorPortalUrl ? <Pressable accessibilityRole="link" onPress={() => onOpenPortal(property)} style={{ paddingVertical: 7 }}><Text style={action}>Otwórz panel administracji</Text></Pressable> : null}
    {property.notes ? <Text style={{ ...muted, marginTop: 5 }}>{property.notes}</Text> : null}
  </View>)}</>;
}

const propertyRow = { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const propertyHeader = { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 12, alignItems: "flex-start" as const };
const propertyName = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "600" as const };
const propertyActions = { flexDirection: "row" as const, gap: 16 };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const dangerAction = { ...action, color: theme.colors.danger };
