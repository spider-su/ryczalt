import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { state: 'loading' | 'error' | 'empty'; message?: string; onRetry?: () => void; color?: string };

export function LoadingState({ state, message, onRetry, color }: Props) {
  const label = message ?? { loading: 'Ładowanie danych…', error: 'Nie udało się wczytać danych.', empty: 'Brak danych.' }[state];
  return (
    <View style={styles.container} accessibilityRole={state === 'error' ? 'alert' : undefined}>
      {state === 'loading' && <ActivityIndicator size="large" color={color} accessibilityLabel="Ładowanie" />}
      <Text style={styles.message}>{label}</Text>
      {state === 'error' && onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Spróbuj ponownie</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { color: '#526178', fontSize: 15, textAlign: 'center', marginTop: 12 },
  retry: { minHeight: 44, padding: 12, justifyContent: 'center' },
  retryText: { fontWeight: '700', color: '#172033' }
});
