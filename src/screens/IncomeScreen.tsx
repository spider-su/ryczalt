import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { createId, todayIsoDate, useRentalData } from '../data/RentalDataProvider';
import type { IncomeEntry } from '../model/rental';
import { theme } from '../theme/theme';

type PaymentDraft = { propertyId: string; amount: string; receivedAt: string; rentalMonth: string; description: string };
const blankDraft = (): PaymentDraft => ({ propertyId: '', amount: '', receivedAt: todayIsoDate(), rentalMonth: '', description: '' });

export function IncomeScreen() {
  const { document, error, update } = useRentalData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(blankDraft());
  const [saving, setSaving] = useState(false);
  const properties = document?.properties ?? [];
  const orderedEntries = useMemo(() => document ? [...document.incomeEntries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)) : [], [document]);
  if (!document) return error ? <View style={{ padding: 24 }}><Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text></View> : <ActivityIndicator style={{ flex: 1 }} />;

  const openNew = () => {
    setEditing(null);
    setDraft({ ...blankDraft(), propertyId: properties[0]?.id ?? '', amount: properties[0]?.defaultMonthlyRent ?? '' });
    setModalOpen(true);
  };
  const openEdit = (entry: IncomeEntry) => {
    setEditing(entry);
    setDraft({ propertyId: entry.propertyId, amount: entry.amount, receivedAt: entry.receivedAt, rentalMonth: entry.rentalMonth ?? '', description: entry.description ?? '' });
    setModalOpen(true);
  };
  const chooseProperty = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    setDraft((current) => ({ ...current, propertyId, amount: current.amount || property?.defaultMonthlyRent || '' }));
  };
  const save = async () => {
    const amount = draft.amount.trim().replace(',', '.');
    if (!properties.some((property) => property.id === draft.propertyId)) { Alert.alert('Wybierz mieszkanie', 'Najpierw dodaj mieszkanie i wybierz je dla wpłaty.'); return; }
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { Alert.alert('Nieprawidłowa kwota', 'Wpisz otrzymaną kwotę większą od zera, maksymalnie do dwóch miejsc po przecinku.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.receivedAt) || Number(draft.receivedAt.slice(5, 7)) > 12 || Number(draft.receivedAt.slice(8, 10)) > 31) { Alert.alert('Nieprawidłowa data', 'Wpisz datę otrzymania w formacie RRRR-MM-DD.'); return; }
    if (draft.rentalMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.rentalMonth)) { Alert.alert('Nieprawidłowy miesiąc', 'Wpisz miesiąc najmu w formacie RRRR-MM.'); return; }
    const selected = properties.find((property) => property.id === draft.propertyId)!;
    const entry: IncomeEntry = {
      id: editing?.id ?? createId('income'), propertyId: draft.propertyId, receivedAt: draft.receivedAt,
      amount, taxableAmount: amount,
      ...(draft.rentalMonth ? { rentalMonth: draft.rentalMonth } : {}),
      ...(editing?.tenantNameSnapshot ?? selected.tenantName ? { tenantNameSnapshot: editing?.tenantNameSnapshot ?? selected.tenantName } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {})
    };
    setSaving(true);
    try {
      await update((current) => ({ ...current, incomeEntries: editing ? current.incomeEntries.map((item) => item.id === editing.id ? entry : item) : [...current.incomeEntries, entry] }));
      setModalOpen(false); setEditing(null);
    } catch { /* The provider reports the save failure. */ } finally { setSaving(false); }
  };
  const remove = (entry: IncomeEntry) => Alert.alert('Usunąć wpłatę?', `Wpłata ${entry.amount} zł z dnia ${entry.receivedAt} zostanie usunięta.`, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: () => { void update((current) => ({ ...current, incomeEntries: current.incomeEntries.filter((item) => item.id !== entry.id) })).catch(() => undefined); } }
  ]);
  const field = (label: string, key: 'amount' | 'receivedAt' | 'rentalMonth' | 'description', options: { keyboardType?: 'default' | 'decimal-pad'; placeholder?: string } = {}) => <View style={{ marginBottom: 14 }} key={key}>
    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={draft[key]} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))} keyboardType={options.keyboardType} placeholder={options.placeholder} placeholderTextColor={theme.colors.textMuted} style={{ color: theme.colors.textPrimary, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder, borderWidth: 1, borderRadius: 8, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 }} />
  </View>;

  return <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: 18 }}>
    <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
      <Text style={{ color: theme.colors.textSecondary }}>Ręczna ewidencja wpływów · {document.settings.taxYear}</Text>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 26, fontWeight: '700', marginTop: 8 }}>Przychód</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.danger, marginTop: 8 }}>{error}</Text> : null}
    </View>
    <FlatList data={orderedEntries} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 }} ListHeaderComponent={<Pressable accessibilityRole="button" onPress={openNew} style={primaryButton}><Text style={primaryText}>＋  Potwierdź otrzymaną wpłatę</Text></Pressable>} ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary, marginTop: 18 }}>{properties.length ? 'Brak potwierdzonych wpłat.' : 'Dodaj mieszkanie w zakładce Ustawienia, aby zapisać wpłatę.'}</Text>} renderItem={({ item }) => {
      const property = properties.find((candidate) => candidate.id === item.propertyId);
      return <View style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.colors.divider }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}><Text style={{ color: theme.colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{property?.name ?? 'Usunięte mieszkanie'}</Text><Text style={muted}>{item.receivedAt}{item.rentalMonth ? ` · za ${item.rentalMonth}` : ''}</Text></View>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 17, fontWeight: '700' }}>{item.amount} zł</Text>
        </View>
        {item.tenantNameSnapshot ? <Text style={muted}>Najemca: {item.tenantNameSnapshot}</Text> : null}
        {item.description ? <Text style={muted}>{item.description}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 7 }}><Text accessibilityRole="button" onPress={() => openEdit(item)} style={action}>Popraw</Text><Text accessibilityRole="button" onPress={() => remove(item)} style={{ ...action, color: theme.colors.danger }}>Usuń</Text></View>
      </View>;
    }} />
    <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: theme.colors.textPrimary, fontSize: 19, fontWeight: '700' }}>{editing ? 'Popraw wpłatę' : 'Potwierdź wpłatę'}</Text><Text onPress={() => setModalOpen(false)} accessibilityRole="button" style={action}>Zamknij</Text></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>Mieszkanie</Text>
          {properties.map((property) => <Pressable key={property.id} accessibilityRole="radio" accessibilityState={{ checked: draft.propertyId === property.id }} onPress={() => chooseProperty(property.id)} style={{ paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: draft.propertyId === property.id ? theme.colors.primary : theme.colors.inputBorder, borderRadius: 8, marginBottom: 7, backgroundColor: draft.propertyId === property.id ? theme.colors.accentSoft : theme.colors.surface }}><Text style={{ color: theme.colors.textPrimary, fontWeight: draft.propertyId === property.id ? '600' : '400' }}>{property.name}</Text></Pressable>)}
          {field('Otrzymana kwota (zł) *', 'amount', { keyboardType: 'decimal-pad', placeholder: 'Wpisz faktycznie otrzymaną kwotę' })}
          {field('Data otrzymania (RRRR-MM-DD) *', 'receivedAt', { placeholder: '2026-09-26' })}
          {field('Miesiąc najmu (RRRR-MM)', 'rentalMonth', { placeholder: '2026-09' })}
          {field('Opis', 'description', { placeholder: 'np. Częściowa wpłata za wrzesień' })}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[primaryButton, saving && { opacity: 0.6 }]}><Text style={primaryText}>{saving ? 'Zapisywanie…' : editing ? 'Zapisz poprawki' : 'Potwierdź otrzymanie wpłaty'}</Text></Pressable>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}

const primaryButton = { backgroundColor: theme.colors.primary, minHeight: 48, borderRadius: 8, justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 16, marginVertical: 8 };
const primaryText = { color: theme.colors.onAccent, fontWeight: '700' as const, fontSize: 15 };
const muted = { color: theme.colors.textSecondary, marginTop: 5, fontSize: 14 };
const action = { color: theme.colors.primary, fontWeight: '600' as const, paddingVertical: 5 };
