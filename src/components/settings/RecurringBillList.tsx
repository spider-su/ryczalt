import { Pressable, Text, View } from "react-native";
import type { Property, RecurringBill } from "../../model/rental";
import { theme } from "../../theme/theme";

export function RecurringBillList({ bills, properties, onDetails, onEdit, onRemove }: {
  bills: RecurringBill[];
  properties: Property[];
  onDetails: (bill: RecurringBill) => void;
  onEdit: (bill: RecurringBill) => void;
  onRemove: (bill: RecurringBill) => void;
}) {
  return <>{bills.map((bill) => {
    const property = properties.find((item) => item.id === bill.propertyId);
    return <View key={bill.id} style={billRow}>
      <Text style={billName}>{bill.name} · {property?.name ?? "Mieszkanie"}</Text>
      <Text style={muted}>{bill.variableAmount ? "Kwotę sprawdź na bieżąco" : bill.expectedAmount ? `${bill.expectedAmount} zł` : "Kwota do sprawdzenia"}{bill.dueDay ? ` · termin ${bill.dueDay}. dzień` : ""}</Text>
      <View style={actions}>
        <Pressable accessibilityRole="button" onPress={() => onDetails(bill)}><Text style={action}>Szczegóły płatności</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => onEdit(bill)}><Text style={action}>Edytuj</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => onRemove(bill)}><Text style={dangerAction}>Usuń</Text></Pressable>
      </View>
    </View>;
  })}</>;
}

const billRow = { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider };
const billName = { color: theme.colors.textPrimary, fontWeight: "600" as const };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const actions = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 16 };
const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const dangerAction = { ...action, color: theme.colors.danger };
