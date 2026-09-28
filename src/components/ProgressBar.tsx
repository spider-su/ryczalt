import { View } from "react-native";
import { theme } from "../theme/theme";

export function ProgressBar({ fraction, quiet = false, accessibilityLabel }: { fraction: number; quiet?: boolean; accessibilityLabel: string }) {
  const bounded = Math.max(0, Math.min(1, fraction));
  return <View accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={{ height: quiet ? 4 : 6, borderRadius: 4, overflow: "hidden", backgroundColor: theme.colors.surfaceMuted, marginVertical: quiet ? 7 : 8 }}>
    <View style={{ width: `${Math.round(bounded * 100)}%`, height: "100%", borderRadius: 4, backgroundColor: quiet ? theme.colors.selectedNavigation : theme.colors.success }} />
  </View>;
}
