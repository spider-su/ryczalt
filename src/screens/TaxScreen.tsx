import { Text, View } from 'react-native';
import { theme } from '../theme/theme';
export function TaxScreen() { return <View style={{ flex: 1, padding: 20, backgroundColor: theme.colors.background }}><Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' }}>Podatek</Text><Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Obliczenia podatkowe i ręczne potwierdzenia wpłat podatku będą dodane w kolejnym etapie.</Text></View>; }
