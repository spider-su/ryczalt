import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { theme } from "../theme/theme";

export function LocalDataRecoveryScreen({ error, retryLoad, copyRawData, resetLocalData }: {
  error: string;
  retryLoad: () => Promise<void>;
  copyRawData: () => Promise<string | null>;
  resetLocalData: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reason = error.includes("not valid JSON")
    ? "Zapisany dokument nie zawiera poprawnego JSON-a."
    : error.includes("schema version")
      ? "Zapisane dane pochodzą z nieobsługiwanej wersji."
      : "Zapisane dane są nieprawidłowe albo nie można ich odczytać.";

  const copy = async () => {
    setBusy(true);
    try {
      const raw = await copyRawData();
      if (raw === null) {
        setMessage("Brak zapisanych danych do skopiowania.");
      } else {
        await Clipboard.setStringAsync(raw);
        setMessage("Surowe dane skopiowane do schowka.");
      }
    } catch {
      setMessage("Nie udało się skopiować zapisanych danych.");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => Alert.alert(
    "Usunąć lokalne dane?",
    "Reset usunie zapisane dane tej aplikacji. Jeśli chcesz je zachować, najpierw skopiuj surowe dane.",
    [
      { text: "Anuluj", style: "cancel" },
      { text: "Resetuj dane", style: "destructive", onPress: () => {
        setBusy(true);
        void resetLocalData().then(() => setMessage("Dane zresetowane.")).catch(() => setMessage("Nie udało się zresetować danych. Niczego nie usunięto.")).finally(() => setBusy(false));
      } },
    ],
  );

  return <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.colors.background }}>
    <Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 12 }}>Nie można otworzyć danych</Text>
    <Text style={{ color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 16 }}>{reason}</Text>
    <Text style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 20 }}>Dane nie zostały automatycznie zmienione. Skopiuj surową zawartość przed resetem, jeśli chcesz ją zachować do odzyskania.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void copy()} style={{ minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 12, marginBottom: 10 }}>
      <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Kopiuj surowe dane</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setBusy(true); void retryLoad().finally(() => setBusy(false)); }} style={{ minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 12, marginBottom: 10 }}>
      <Text style={{ color: theme.colors.textPrimary, fontWeight: "700" }}>Spróbuj ponownie</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={confirmReset} style={{ minHeight: 48, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.danger, borderRadius: 12 }}>
      <Text style={{ color: "white", fontWeight: "700" }}>Resetuj dane lokalne</Text>
    </Pressable>
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textSecondary, marginTop: 14 }}>{message}</Text>}
  </View>;
}
