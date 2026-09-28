import { Text, View } from "react-native";
import { theme } from "../theme/theme";

type Tone = "neutral" | "positive" | "attention" | "info";

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const colors = tone === "positive" ? [theme.colors.successSoft, theme.colors.success]
    : tone === "attention" ? [theme.colors.warningSoft, theme.colors.warning]
      : tone === "info" ? [theme.colors.infoSoft, theme.colors.info]
          : [theme.colors.surfaceMuted, theme.colors.textSecondary];
  return <View accessibilityRole="text" style={[badge, { backgroundColor: colors[0] }]}>
    <Text style={[labelStyle, { color: colors[1] }]}>{label}</Text>
  </View>;
}

const badge = { alignSelf: "flex-start" as const, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 };
const labelStyle = { fontSize: 12, lineHeight: 16, fontWeight: "700" as const };
