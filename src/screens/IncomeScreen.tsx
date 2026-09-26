import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { loadRentalDocument } from '../data/localRentalStore';
import type { RentalDocument } from '../model/rental';
import { theme } from '../theme/theme';
export function IncomeScreen() {
  const [data, setData] = useState<RentalDocument | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void loadRentalDocument().then(setData).catch(() => setError('Nie udało się odczytać danych lokalnych.')); }, []);
  if (error) return <View style={{ padding: 24 }}><Text>{error}</Text></View>;
  if (!data) return <ActivityIndicator style={{ flex: 1 }} />;
  return <View style={{ flex: 1, padding: 20, backgroundColor: theme.colors.background }}>
    <Text style={{ color: theme.colors.textSecondary }}>Przychód · {data.settings.taxYear}</Text>
    <Text style={{ color: theme.colors.textPrimary, fontSize: 30, fontWeight: '700', marginVertical: 12 }}>Ryczałt</Text>
    <Text style={{ color: theme.colors.textSecondary, marginBottom: 18 }}>Potwierdzone wpłaty</Text>
    <FlatList data={data.incomeEntries} keyExtractor={(item) => item.id} ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary }}>Brak potwierdzonych wpłat. Dodawanie wpłat zostanie wdrożone w kolejnym etapie.</Text>} renderItem={({ item }) => <Text style={{ color: theme.colors.textPrimary, paddingVertical: 12 }}>{item.receivedAt} · {item.amount} zł</Text>} />
  </View>;
}
