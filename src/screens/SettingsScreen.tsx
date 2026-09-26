import { Text, View } from 'react-native';
import { theme } from '../theme/theme';
export function SettingsScreen() { return <View style={{ flex: 1, padding: 20, backgroundColor: theme.colors.background }}><Text style={{ color: theme.colors.textPrimary, fontSize: 24, fontWeight: '700' }}>Ustawienia</Text><Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Mieszkania, aktualny najemca i kopia JSON — następny etap.</Text></View>; }
