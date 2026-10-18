import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions, TextInputProps } from "react-native";
import { theme } from "../theme/theme";
import { ui } from "../theme/ui";

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
      minHeight: 48, borderRadius: theme.radius.control, paddingHorizontal: 16,
      justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8,
      backgroundColor: filled ? background : theme.colors.surface,
      borderWidth: filled ? 0 : 1, borderColor: theme.colors.inputBorder,
      opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1,
    })}>
    {busy ? <ActivityIndicator color={filled ? theme.colors.onAccent : theme.colors.primary} /> : null}
    <Text style={{ color: filled ? theme.colors.onAccent : theme.colors.textPrimary, fontWeight: "700" }}>{label}</Text>
  </Pressable>;
}

export function FormField({ label, value, onChangeText, error, keyboardType = "default", placeholder, children, multiline = false, autoCapitalize, selectTextOnFocus }: {
  label: string; value: string; onChangeText: (value: string) => void; error?: string;
  keyboardType?: KeyboardTypeOptions; placeholder?: string; children?: ReactNode; multiline?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"]; selectTextOnFocus?: boolean;
}) {
  return <View style={{ gap: 6 }}>
    <Text style={ui.fieldLabel}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={theme.colors.textMuted}
      multiline={multiline} autoCapitalize={autoCapitalize} selectTextOnFocus={selectTextOnFocus}
      textAlignVertical={multiline ? "top" : "center"}
      style={[ui.input, multiline && { minHeight: 84, paddingVertical: 10 }, error && { borderColor: theme.colors.danger }]} />
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
