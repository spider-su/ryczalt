import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { FormButton, FormFeedback } from "../components/FormControls";
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
    <View style={{ gap: 10 }}>
      <FormButton label="Kopiuj surowe dane" tone="secondary" disabled={busy} onPress={() => void copy()} />
      <FormButton label="Spróbuj ponownie" tone="secondary" busy={busy} onPress={() => { setBusy(true); void retryLoad().finally(() => setBusy(false)); }} />
      <FormButton label="Resetuj dane lokalne" tone="danger" disabled={busy} onPress={confirmReset} />
    </View>
    {!!message && <View style={{ marginTop: 14 }}><FormFeedback message={message} error={message.startsWith("Nie udało")} /></View>}
  </View>;
}
