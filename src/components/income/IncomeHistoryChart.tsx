import { useMemo } from "react";
import { Text, View } from "react-native";
import type { IncomeEntry } from "../../model/rental";
import { formatPln } from "../../domain/ryczaltTax";
import { formatPlnSummary } from "../../domain/presentationFormat";
import { formatPolishMonth, formatPolishMonthName } from "../../domain/presentationFormat";
import { incomeTimeWindow } from "../../domain/incomeHistory";
import { theme } from "../../theme/theme";

export function IncomeHistoryChart({ entries, propertyId, year }: { entries: IncomeEntry[]; propertyId: string | null; year: number }) {
  const chart = useMemo(() => incomeTimeWindow(entries, new Date(), propertyId, year), [entries, propertyId, year]);
  const selected = chart.find(({ selected: isSelected }) => isSelected)!;
  const actualAmounts = chart.flatMap(({ totalGrosz }) => totalGrosz === null ? [] : [totalGrosz]);
  const maxChart = Math.max(1, ...actualAmounts);
  const selectedLabel = formatPolishMonthName(selected.month);
  const selectedSummary = selected.totalGrosz
    ? `${selectedLabel} · otrzymano ${formatPln(selected.totalGrosz)}`
    : `${selectedLabel} · brak zapisanych wpłat`;
  const chartSummary = chart.map((item) => item.period === "future"
    ? `${formatPolishMonth(item.month)} · przyszły miesiąc`
    : `${formatPolishMonth(item.month)} · otrzymano ${formatPln(item.totalGrosz ?? 0)}`).join(". ");
  return <View>
    <View style={chartHeader}><Text style={sectionTitle}>Wpłaty w czasie</Text></View>
    <Text style={currentSummary}>{selectedSummary}</Text>
    <View accessible accessibilityRole="summary" accessibilityLabel={chartSummary} style={chartContainer}>
      {chart.map((item) => {
        const isSelected = item.selected;
        const isFuture = item.period === "future";
        const label = item.totalGrosz ? formatPlnSummary(item.totalGrosz) : "";
        const spokenLabel = isFuture ? `${formatPolishMonth(item.month)} · przyszły miesiąc` : `${formatPolishMonth(item.month)} · otrzymano ${formatPln(item.totalGrosz ?? 0)}`;
        const monthLabel = formatPolishMonthName(item.month).slice(0, 3).toLocaleUpperCase("pl-PL");
        const yearSuffix = Number(item.month.slice(0, 4)) === year ? "" : ` ${item.month.slice(2, 4)}`;
        return <View key={item.month} accessible accessibilityRole="image" style={[barColumn, isSelected && selectedBarColumn]} accessibilityLabel={spokenLabel}>
        <Text numberOfLines={1} style={[barValue, isSelected && currentBarValue]}>{label}</Text>
        <View style={[barTrack, isFuture && futureTrack]}>{!isFuture && item.totalGrosz ? <View style={[barFill, { height: `${Math.max(3, item.totalGrosz / maxChart * 100)}%` }]} /> : null}</View>
        <Text style={[barMonth, isSelected && currentBarMonth, isFuture && futureMonth]}>{monthLabel}{yearSuffix}</Text>
      </View>;
      })}
    </View>
  </View>;
}

const chartHeader = { flexDirection: "row" as const, alignItems: "baseline" as const, justifyContent: "space-between" as const, gap: 8 };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const, marginTop: 18, marginBottom: 4 };
const currentSummary = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const, marginBottom: 2 };
const chartContainer = { height: 124, flexDirection: "row" as const, alignItems: "stretch" as const, justifyContent: "space-around" as const, marginBottom: 8, paddingTop: 6 };
const barColumn = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const, paddingHorizontal: 0 };
const barValue = { color: theme.colors.textSecondary, fontSize: 9, height: 18, textAlign: "center" as const, width: "100%" as const };
const barTrack = { height: 78, width: "46%" as const, justifyContent: "flex-end" as const, borderBottomWidth: 1, borderColor: theme.colors.borderSubtle };
const barFill = { width: "100%" as const, backgroundColor: theme.colors.success, borderTopLeftRadius: 4, borderTopRightRadius: 4 };
const barMonth = { color: theme.colors.textSecondary, fontSize: 10, marginTop: 6 };
const futureTrack = { backgroundColor: "#E9F0F4", borderTopLeftRadius: 4, borderTopRightRadius: 4 };
const futureMonth = { color: theme.colors.textMuted };
const selectedBarColumn = { flex: 1.15, backgroundColor: theme.colors.surfaceMuted, borderRadius: 7 };
const currentBarValue = { color: theme.colors.textPrimary, fontWeight: "700" as const };
const currentBarMonth = { color: theme.colors.textPrimary, fontWeight: "700" as const };
