import { Pressable, Text, View } from "react-native";
import { theme } from "../theme/theme";

export function PeriodSelector({
  value,
  valueLabel,
  previousLabel,
  nextLabel,
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext,
}: {
  value: string;
  valueLabel: string;
  previousLabel: string;
  nextLabel: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return <View style={container}>
    <Pressable accessibilityRole="button" accessibilityLabel={previousLabel} accessibilityState={{ disabled: previousDisabled }} disabled={previousDisabled} onPress={onPrevious} style={arrow}>
      <Text style={[arrowText, previousDisabled && disabledArrow]}>‹</Text>
    </Pressable>
    <Text accessibilityRole="header" accessibilityLabel={valueLabel} style={valueText}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled} onPress={onNext} style={arrow}>
      <Text style={[arrowText, nextDisabled && disabledArrow]}>›</Text>
    </Pressable>
  </View>;
}

const container = { width: "100%" as const, minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
const arrow = { width: 48, height: 48, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 12 };
const arrowText = { color: theme.colors.primary, fontSize: 25, fontWeight: "500" as const, lineHeight: 28 };
const disabledArrow = { color: theme.colors.disabled };
const valueText = { flex: 1, color: theme.colors.textPrimary, textAlign: "center" as const, fontSize: 17, fontWeight: "700" as const, textTransform: "capitalize" as const };
