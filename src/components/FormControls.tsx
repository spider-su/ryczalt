import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { theme } from "../theme/theme";

type ButtonTone = "primary" | "secondary" | "danger";
export function FormButton({ label, onPress, disabled = false, busy = false, tone = "primary" }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: ButtonTone;
}) {
  const filled = tone !== "secondary";
  const background = tone === "danger" ? theme.colors.danger : theme.colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy}
    onPress={onPress}
    style={({ pressed }) => ({
      minHeight: 48, borderRadius: 12, paddingHorizontal: 16,
      justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8,
      backgroundColor: filled ? background : theme.colors.surface,
      borderWidth: filled ? 0 : 1, borderColor: theme.colors.inputBorder,
      opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1,
    })}>
    {busy ? <ActivityIndicator color={filled ? theme.colors.onAccent : theme.colors.primary} /> : null}
    <Text style={{ color: filled ? theme.colors.onAccent : theme.colors.textPrimary, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
}

export function FormField({ label, value, onChangeText, error, keyboardType = "default", placeholder, children }: {
  label: string; value: string; onChangeText: (value: string) => void; error?: string;
  keyboardType?: KeyboardTypeOptions; placeholder?: string; children?: ReactNode;
}) {
  return <View style={{ gap: 6 }}>
    <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={theme.colors.textMuted}
      style={{ minHeight: 48, borderRadius: 12, borderWidth: 1,
        borderColor: error ? theme.colors.danger : theme.colors.inputBorder,
        color: theme.colors.textPrimary, paddingHorizontal: 12, backgroundColor: theme.colors.inputBackground }} />
    {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text> : null}
    {children}
  </View>;
}

export function FormFeedback({ message, error = false }: { message: string; error?: boolean }) {
  return <View accessibilityRole={error ? "alert" : undefined}
    style={{ borderLeftWidth: 3, borderLeftColor: error ? theme.colors.danger : theme.colors.info,
      backgroundColor: theme.colors.surface, padding: 12, borderRadius: 8 }}>
    <Text style={{ color: theme.colors.textPrimary }}>{message}</Text>
  </View>;
}
