import { Pressable, Text, View } from "react-native";
import type { IncomeEntry } from "../../model/rental";
import { theme } from "../../theme/theme";
import { formatPlnAmount } from "../../domain/ryczaltTax";
import { formatPolishDate, formatPolishMonth } from "../../domain/presentationFormat";

export function IncomeEntryRow({ entry, propertyName, onOpen }: {
  entry: IncomeEntry;
  propertyName: string;
  onOpen: () => void;
}) {
  const details = [formatPolishDate(entry.receivedAt), entry.tenantNameSnapshot, entry.rentalMonth ? `za ${formatPolishMonth(entry.rentalMonth)}` : undefined].filter(Boolean).join(" · ");
  return <Pressable accessibilityRole="button" accessibilityLabel={`${propertyName}, ${formatPlnAmount(entry.amount)}, ${details}. Opcje wpłaty`} onPress={onOpen} style={entryRow}>
    <View style={{ flex: 1 }}><Text numberOfLines={1} style={propertyNameStyle}>{propertyName}</Text><Text numberOfLines={1} style={muted}>{details}</Text></View>
    <Text style={amount}>{formatPlnAmount(entry.amount)}</Text>
    <Text style={menuGlyph}>⋮</Text>
  </Pressable>;
}

const entryRow = { minHeight: 66, flexDirection: "row" as const, alignItems: "center" as const, gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.colors.divider };
const propertyNameStyle = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" as const };
const amount = { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" as const };
const muted = { color: theme.colors.textSecondary, marginTop: 3, fontSize: 12 };
const menuGlyph = { color: theme.colors.textSecondary, fontSize: 20, paddingHorizontal: 3 };
