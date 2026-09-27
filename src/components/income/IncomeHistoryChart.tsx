import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { IncomeEntry, Property } from "../../model/rental";
import { formatPln } from "../../domain/ryczaltTax";
import { incomeHistory } from "../../domain/rentalPresentation";
import { theme } from "../../theme/theme";

export function IncomeHistoryChart({ entries, properties }: { entries: IncomeEntry[]; properties: Property[] }) {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const chart = useMemo(() => incomeHistory(entries, new Date(), propertyId), [entries, propertyId]);
  const maxChart = Math.max(1, ...chart.map((item) => item.total));
  return <View>
    <Text style={sectionTitle}>Wpływy z ostatnich 6 miesięcy</Text>
    <View style={chartFilter}>{[{ id: null, name: "Wszystkie" }, ...properties.map((property) => ({ id: property.id, name: property.name }))].map((item) =>
      <Pressable key={item.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: propertyId === item.id }} onPress={() => setPropertyId(item.id)} style={[filterButton, propertyId === item.id && selectedFilter]}><Text style={filterText}>{item.name}</Text></Pressable>)}</View>
    <View accessibilityLabel="Wykres potwierdzonych wpływów z sześciu miesięcy" style={chartContainer}>
      {chart.map((item) => <View key={item.month} style={barColumn}>
        <Text style={barValue}>{item.total ? formatPln(item.total).replace(" zł", "") : "–"}</Text>
        <View style={barTrack}><View style={[barFill, { height: `${item.total ? Math.max(4, item.total / maxChart * 100) : 0}%` }]} /></View>
        <Text style={barMonth}>{item.month.slice(5)}</Text>
      </View>)}
    </View>
  </View>;
}

const sectionTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const, marginTop: 18, marginBottom: 4 };
const chartFilter = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginVertical: 8 };
const filterButton = { borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.surface };
const selectedFilter = { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.primary };
const filterText = { color: theme.colors.textPrimary, fontSize: 11 };
const chartContainer = { height: 145, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surface, borderRadius: 16, flexDirection: "row" as const, alignItems: "stretch" as const, justifyContent: "space-around" as const, marginBottom: 10, paddingTop: 8 };
const barColumn = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const, paddingHorizontal: 2 };
const barValue = { color: theme.colors.textMuted, fontSize: 9, height: 18, textAlign: "center" as const };
const barTrack = { height: 98, width: "55%" as const, backgroundColor: theme.colors.surfaceMuted, justifyContent: "flex-end" as const, borderRadius: 6, overflow: "hidden" as const };
const barFill = { width: "100%" as const, backgroundColor: theme.colors.primary, minHeight: 0 };
const barMonth = { color: theme.colors.textSecondary, fontSize: 10, marginVertical: 6 };
