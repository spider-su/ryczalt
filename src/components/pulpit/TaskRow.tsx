import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { AssistantTask, TaskStatus } from "../../domain/tasks";
import { theme } from "../../theme/theme";
import { formatPln } from "../../domain/ryczaltTax";
import { upcomingTaskPresentation } from "../../domain/rentalPresentation";
import { formatPolishDate } from "../../domain/presentationFormat";
import { StatusBadge } from "../StatusBadge";

const typeLabel: Record<AssistantTask["type"], string> = {
  TENANT_PAYMENT_CHECK: "Czynsz", TAX_PAYMENT: "Podatek", RENTAL_AGREEMENT_END: "Umowa",
};
const statusLabel: Record<TaskStatus, string> = {
  upcoming: "Nadchodzące", "needs-attention": "Do sprawdzenia", snoozed: "Uśpione", completed: "Zakończone", dismissed: "Ukryte",
};

export function TaskRow({ task, onOpen, onSnooze, onDismiss, onComplete, compact = false }: { task: AssistantTask; onOpen: () => void; onSnooze: () => void; onDismiss: () => void; onComplete: () => void; compact?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stateTone = task.status === "needs-attention" ? "attention" as const : task.status === "snoozed" ? "info" as const : task.status === "completed" ? "positive" as const : "neutral" as const;
  const detail = rentTaskSummary(task);
  const upcoming = upcomingTaskPresentation(task);
  if (compact) return <View style={upcomingCard}>
    <Pressable accessibilityRole="button" onPress={onOpen} style={{ flex: 1, justifyContent: "center" }}><Text style={taskTitle} numberOfLines={1}>{upcoming.title}</Text><Text style={upcomingMeta} numberOfLines={1}>{upcoming.amount}{upcoming.amount ? " · " : ""}{formatPolishDate(task.dueAt)}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Przypomnij później: ${task.title}`} onPress={onSnooze} style={actionTarget}><Text style={action}>Odłóż</Text></Pressable>
  </View>;
  return <View style={taskCard}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <View style={{ flex: 1 }}><Text style={taskTitle}>{task.title}</Text><Text style={muted}>{detail || task.detail || typeLabel[task.type]}</Text></View>
      <StatusBadge label={statusLabel[task.status]} tone={stateTone} />
    </View>
    <Text style={taskMeta}>{typeLabel[task.type]} · termin {formatPolishDate(task.dueAt, "long")}</Text>
    <View style={taskActions}>
      {task.status !== "dismissed" && task.status !== "completed" ? <>
        <Pressable accessibilityRole="button" onPress={onOpen} style={actionTarget}><Text style={action}>{task.type === "TENANT_PAYMENT_CHECK" ? "Potwierdź wpłatę" : task.type === "RENTAL_AGREEMENT_END" ? "Zmień datę zakończenia" : "Otwórz"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Więcej działań" accessibilityState={{ expanded: menuOpen }} onPress={() => setMenuOpen((open) => !open)} style={actionTarget}><Text style={muted}>•••</Text></Pressable>
        {menuOpen ? <>
          <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onSnooze(); }} style={actionTarget}><Text style={action}>Przypomnij później</Text></Pressable>
          {task.manuallyCompletable ? <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onComplete(); }} style={actionTarget}><Text style={action}>Oznacz jako załatwione</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); onDismiss(); }} style={actionTarget}><Text style={muted}>Ukryj</Text></Pressable>
        </> : null}
      </> : task.status === "completed" ? <Text style={muted}>Wynika z zapisanych danych</Text> : null}
    </View>
  </View>;
}

const taskCard = { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 8, padding: 12, marginVertical: 4 };
const upcomingCard = { backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 };
const taskTitle = { color: theme.colors.textPrimary, fontWeight: "700" as const, fontSize: 15 };
const taskMeta = { color: theme.colors.textMuted, fontSize: 11, marginTop: 7 };
const taskActions = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 14, marginTop: 9 };
const actionTarget = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 5 };
const muted = { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 };
const action = { color: theme.colors.primary, fontWeight: "700" as const, fontSize: 13 };

function rentTaskSummary(task: AssistantTask) {
  if (task.type !== "TENANT_PAYMENT_CHECK") return task.detail;
  if (task.status === "completed") return task.expectedGrosz ? `✓ Potwierdzone · ${formatPln(task.expectedGrosz)}` : "✓ Potwierdzone";
  if ((task.confirmedGrosz ?? 0) > 0) return `Pozostało ${formatPln(task.remainingGrosz ?? 0)}.`;
  return "Do potwierdzenia.";
}

const upcomingMeta = { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 };
