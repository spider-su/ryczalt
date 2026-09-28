import { Pressable, Text, View } from "react-native";
import type { IncomeEntry } from "../../model/rental";
import { theme } from "../../theme/theme";
import { ui } from "../../theme/ui";
import { formatPlnAmount } from "../../domain/ryczaltTax";
import { formatPolishDate, formatPolishMonth } from "../../domain/presentationFormat";

export function IncomeEntryRow({ entry, propertyName, onEdit, onRemove }: {
  entry: IncomeEntry;
  propertyName: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return <View style={entryRow}>
    <View style={entryHeader}>
      <View style={{ flex: 1 }}><Text style={propertyNameStyle}>{propertyName}</Text><Text style={muted}>{formatPolishDate(entry.receivedAt, "long")}{entry.rentalMonth ? ` · za ${formatPolishMonth(entry.rentalMonth)}` : ""}</Text></View>
      <View><Text style={amount}>{formatPlnAmount(entry.amount)}</Text>{entry.taxableAmount !== entry.amount ? <Text style={muted}>Podatkowa: {formatPlnAmount(entry.taxableAmount)}</Text> : null}</View>
    </View>
    {entry.tenantNameSnapshot ? <Text style={muted}>Najemca: {entry.tenantNameSnapshot}</Text> : null}
    {entry.description ? <Text style={muted}>{entry.description}</Text> : null}
    <View style={actions}>
      <Pressable accessibilityRole="button" onPress={onEdit}><Text style={action}>Popraw</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onRemove}><Text style={dangerAction}>Usuń</Text></Pressable>
    </View>
  </View>;
}

const entryRow = { ...ui.card, padding: 14, marginVertical: 5 };
const entryHeader = { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 12 };
const propertyNameStyle = { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" as const };
const amount = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const actions = { flexDirection: "row" as const, gap: 18, marginTop: 7 };
const action = { color: theme.colors.primary, fontWeight: "600" as const, paddingVertical: 5 };
const dangerAction = { ...action, color: theme.colors.danger };
