import { useMemo } from "react";
import { Text, View } from "react-native";
import type { IncomeEntry } from "../../model/rental";
import { formatPln } from "../../domain/ryczaltTax";
import { incomeHistory } from "../../domain/rentalPresentation";
import { formatPolishMonth } from "../../domain/presentationFormat";
import { theme } from "../../theme/theme";

export function IncomeHistoryChart({ entries, propertyId, year }: { entries: IncomeEntry[]; propertyId: string | null; year: number }) {
  const chart = useMemo(() => incomeHistory(entries, new Date(), propertyId, year), [entries, propertyId, year]);
  const maxChart = Math.max(0, ...chart.map((item) => item.total));
  return <View>
    <View style={chartHeader}><Text style={sectionTitle}>Ostatnie 6 miesięcy</Text><Text style={filterLabel}>{propertyId ? "Wybrane mieszkanie" : "Wszystkie mieszkania"}</Text></View>
    {maxChart === 0 ? <View accessibilityLabel="Brak wpływów w ostatnich sześciu miesiącach" style={emptyChart}><Text style={emptyChartText}>Brak wpływów w tym okresie</Text></View> : <View accessibilityLabel="Wykres potwierdzonych wpływów z sześciu miesięcy" style={chartContainer}>
      {chart.map((item) => <View key={item.month} style={barColumn} accessibilityLabel={`${formatPolishMonth(item.month)}: ${formatPln(item.total)}`}>
        <Text numberOfLines={1} style={barValue}>{item.total ? formatPln(item.total).replace(",00 zł", " zł") : ""}</Text>
        <View style={barTrack}><View style={[barFill, { height: item.total ? `${Math.max(3, item.total / maxChart * 100)}%` : 0 }]} /></View>
        <Text style={barMonth}>{formatPolishMonth(item.month).slice(0, 3)}</Text>
      </View>)}
    </View>}
  </View>;
}

const chartHeader = { flexDirection: "row" as const, alignItems: "baseline" as const, justifyContent: "space-between" as const, gap: 8 };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const, marginTop: 18, marginBottom: 4 };
const filterLabel = { color: theme.colors.textSecondary, fontSize: 12 };
const emptyChart = { height: 102, alignItems: "center" as const, justifyContent: "center" as const, borderBottomWidth: 1, borderColor: theme.colors.borderSubtle };
const emptyChartText = { color: theme.colors.textMuted, fontSize: 13 };
const chartContainer = { height: 124, flexDirection: "row" as const, alignItems: "stretch" as const, justifyContent: "space-around" as const, marginBottom: 8, paddingTop: 6 };
const barColumn = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const, paddingHorizontal: 1 };
const barValue = { color: theme.colors.textMuted, fontSize: 8, height: 17, textAlign: "center" as const, width: "100%" as const };
const barTrack = { height: 78, width: "48%" as const, justifyContent: "flex-end" as const, borderBottomWidth: 1, borderColor: theme.colors.borderSubtle };
const barFill = { width: "100%" as const, backgroundColor: theme.colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 };
const barMonth = { color: theme.colors.textSecondary, fontSize: 10, marginTop: 6 };
