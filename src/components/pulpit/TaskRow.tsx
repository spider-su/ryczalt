import { Pressable, Text, View } from "react-native";
import type { AssistantTask, TaskStatus } from "../../domain/tasks";
import { theme } from "../../theme/theme";

const typeLabel: Record<AssistantTask["type"], string> = {
  TENANT_PAYMENT_CHECK: "Czynsz", TAX_PAYMENT: "Podatek", RECURRING_BILL: "Rachunek",
  RENTAL_AGREEMENT_END: "Umowa", CUSTOM_REMINDER: "Osobiste",
};
const statusLabel: Record<TaskStatus, string> = {
  upcoming: "Nadchodzące", "needs-attention": "Do sprawdzenia", snoozed: "Uśpione", completed: "Zakończone", dismissed: "Ukryte",
};

export function TaskRow({ task, onOpen, onSnooze, onDismiss, onComplete }: { task: AssistantTask; onOpen: () => void; onSnooze: () => void; onDismiss: () => void; onComplete: () => void }) {
  const stateColor = task.status === "needs-attention" ? theme.colors.warning : task.status === "snoozed" ? theme.colors.info : task.status === "completed" ? theme.colors.success : theme.colors.textSecondary;
  return <View style={taskCard}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <View style={{ flex: 1 }}><Text style={taskTitle}>{task.title}</Text><Text style={muted}>{task.detail || typeLabel[task.type]}</Text></View>
      <Text style={[statusText, { color: stateColor }]}>{statusLabel[task.status]}</Text>
    </View>
    <Text style={taskMeta}>{typeLabel[task.type]} · termin {task.dueAt.toLocaleDateString("pl-PL")}</Text>
    <View style={taskActions}>
      {task.status !== "dismissed" && task.status !== "completed" ? <>
        <Pressable accessibilityRole="button" onPress={onOpen}><Text style={action}>{task.type === "CUSTOM_REMINDER" ? "Szczegóły" : task.type === "RENTAL_AGREEMENT_END" ? "Zmień datę zakończenia" : "Otwórz"}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onSnooze}><Text style={action}>Przypomnij później</Text></Pressable>
        {task.manuallyCompletable ? <Pressable accessibilityRole="button" onPress={onComplete}><Text style={action}>Oznacz jako załatwione</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={onDismiss}><Text style={muted}>Ukryj</Text></Pressable>
      </> : task.status === "completed" ? <Text style={muted}>{task.type === "RECURRING_BILL" ? "Ręcznie potwierdzona płatność" : "Wynika z zapisanych danych"}</Text> : null}
    </View>
  </View>;
}

const taskCard = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, padding: 12, marginVertical: 4 };
const taskTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 15 };
const statusText = { fontSize: 11, fontWeight: "700" as const };
const taskMeta = { color: theme.colors.textMuted, fontSize: 11, marginTop: 7 };
const taskActions = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 14, marginTop: 9 };
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };
