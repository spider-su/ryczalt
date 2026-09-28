import { useMemo } from "react";
import { Text, View } from "react-native";
import type { IncomeEntry } from "../../model/rental";
import { formatPln } from "../../domain/ryczaltTax";
import { incomeHistory } from "../../domain/rentalPresentation";
import { formatPolishMonth } from "../../domain/presentationFormat";
import { currentMonthIncomeLabel } from "../../domain/incomeHistory";
import { theme } from "../../theme/theme";

export function IncomeHistoryChart({ entries, propertyId, year, expectedCurrentGrosz }: { entries: IncomeEntry[]; propertyId: string | null; year: number; expectedCurrentGrosz?: number }) {
  const chart = useMemo(() => incomeHistory(entries, new Date(), propertyId, year), [entries, propertyId, year]);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const maxChart = Math.max(0, ...chart.map((item) => item.total), expectedCurrentGrosz ?? 0);
  const chartSummary = chart.map((item) => `${formatPolishMonth(item.month)}: otrzymano ${formatPln(item.total)}${item.month === currentMonth && expectedCurrentGrosz !== undefined ? `, oczekiwany czynsz ${formatPln(expectedCurrentGrosz)}` : ""}`).join(". ");
  return <View>
    <View style={chartHeader}><Text style={sectionTitle}>Ostatnie 6 miesięcy</Text></View>
    <Text style={currentSummary}>Słupki pokazują otrzymane wpłaty.</Text>
    {expectedCurrentGrosz !== undefined ? <><Text style={currentSummary}>{currentMonthIncomeLabel(currentMonth, chart.find((item) => item.month === currentMonth)?.total ?? 0, expectedCurrentGrosz)}</Text><Text style={chartHint}>Jasne tło bieżącego miesiąca pokazuje oczekiwany czynsz.</Text></> : null}
    {maxChart === 0 ? <View accessible accessibilityRole="summary" accessibilityLabel="Brak otrzymanych wpłat w ostatnich sześciu miesiącach" style={emptyChart}><Text style={emptyChartText}>Brak otrzymanych wpłat w tym okresie</Text></View> : <View accessible accessibilityRole="summary" accessibilityLabel={chartSummary} style={chartContainer}>
      {chart.map((item) => {
        const isCurrent = item.month === currentMonth;
        const expected = isCurrent ? expectedCurrentGrosz : undefined;
        const label = item.total ? formatPln(item.total).replace(",00 zł", " zł") : "0 zł";
        const spokenLabel = `${formatPolishMonth(item.month)} · otrzymano ${formatPln(item.total)}${expected !== undefined ? ` · oczekiwany czynsz ${formatPln(expected)}` : ""}`;
        return <View key={item.month} accessible accessibilityRole="image" style={[barColumn, isCurrent && currentBarColumn]} accessibilityLabel={spokenLabel}>
        <Text numberOfLines={1} style={[barValue, isCurrent && currentBarValue]}>{label}</Text>
        <View style={barTrack}>{expected !== undefined ? <View style={[barExpected, { height: expected ? `${expected / maxChart * 100}%` : 0 }]} /> : null}<View style={[barFill, { height: item.total ? `${Math.max(3, item.total / maxChart * 100)}%` : 0 }]} /></View>
        <Text style={[barMonth, isCurrent && currentBarMonth]}>{formatPolishMonth(item.month).slice(0, 3)}</Text>
      </View>;
      })}
    </View>}
  </View>;
}

const chartHeader = { flexDirection: "row" as const, alignItems: "baseline" as const, justifyContent: "space-between" as const, gap: 8 };
const sectionTitle = { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" as const, marginTop: 18, marginBottom: 4 };
const currentSummary = { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" as const, marginBottom: 2 };
const chartHint = { color: theme.colors.textMuted, fontSize: 11, marginBottom: 4 };
const emptyChart = { height: 102, alignItems: "center" as const, justifyContent: "center" as const, borderBottomWidth: 1, borderColor: theme.colors.borderSubtle };
const emptyChartText = { color: theme.colors.textMuted, fontSize: 13 };
const chartContainer = { height: 124, flexDirection: "row" as const, alignItems: "stretch" as const, justifyContent: "space-around" as const, marginBottom: 8, paddingTop: 6 };
const barColumn = { flex: 1, alignItems: "center" as const, justifyContent: "flex-end" as const, paddingHorizontal: 1 };
const barValue = { color: theme.colors.textSecondary, fontSize: 10, height: 18, textAlign: "center" as const, width: "100%" as const };
const barTrack = { height: 78, width: "48%" as const, justifyContent: "flex-end" as const, borderBottomWidth: 1, borderColor: theme.colors.borderSubtle };
const barExpected = { position: "absolute" as const, bottom: 0, width: "100%" as const, backgroundColor: theme.colors.surfaceMuted, borderTopLeftRadius: 4, borderTopRightRadius: 4 };
const barFill = { width: "100%" as const, backgroundColor: theme.colors.success, borderTopLeftRadius: 4, borderTopRightRadius: 4 };
const barMonth = { color: theme.colors.textSecondary, fontSize: 11, marginTop: 6 };
const currentBarColumn = { backgroundColor: theme.colors.surfaceMuted, borderRadius: 7 };
const currentBarValue = { color: theme.colors.textPrimary, fontWeight: "700" as const };
const currentBarMonth = { color: theme.colors.textPrimary, fontWeight: "700" as const };
