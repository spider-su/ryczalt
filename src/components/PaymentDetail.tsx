import { Pressable, Text, View } from "react-native";
import { theme } from "../theme/theme";

export function PaymentDetail({ label, value, onCopy }: { label: string; value?: string; onCopy: () => void }) {
  return <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
    <Text style={{ color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 }}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text selectable style={{ color: theme.colors.textPrimary, flex: 1 }}>{value || "Nie skonfigurowano"}</Text>
      {value ? <Pressable accessibilityRole="button" accessibilityLabel={`Kopiuj: ${label}`} onPress={onCopy}><Text style={{ color: theme.colors.primary, fontWeight: "600", paddingVertical: 5 }}>Kopiuj</Text></Pressable> : null}
    </View>
  </View>;
}
