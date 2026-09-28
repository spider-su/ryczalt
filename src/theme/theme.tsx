import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, StyleSheet } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import type { AppearancePreference, ThemeMode } from './appearance';
export type { AppearancePreference, ThemeMode } from './appearance';

export const APPEARANCE_STORAGE_KEY = 'ryczalt.ui.appearance';

const lightColors = {
  canvas: '#F4F6F9', background: '#F4F6F9', surface: '#FFFFFF', surfaceSecondary: '#F7F8FA', surfaceElevated: '#FFFFFF', surfaceMuted: '#F1F3F6',
  textPrimary: '#17263C', textSecondary: '#536176', textMuted: '#64748B', borderSubtle: '#E3E8EF', divider: '#E9EDF2', interactive: '#34465D',
  brandAction: '#D20A32', brandActionPressed: '#AF092A', accent: '#D20A32', accentPressed: '#AF092A', accentSoft: '#FFF0F3',
  success: '#18794E', successSoft: '#E8F6EE', warning: '#9A6700', warningSoft: '#FFF5D6', danger: '#B42318', dangerSoft: '#FDEDEC', info: '#45627F', infoSoft: '#EDF3F8', onAccent: '#FFFFFF', overlay: '#15223866', inputBackground: '#FFFFFF', inputBorder: '#E3E8EF', disabled: '#A8B3C2', focusRing: '#D20A32', selectedNavigation: '#17263C', inactiveNavigation: '#64748B', selectedSurface: '#F1F4F8', selectedBorder: '#C8D2DF', modalBackground: '#FFFFFF',
  text: '#17263C', border: '#E3E8EF', primary: '#17263C', primarySoft: '#F1F4F8'
} as const;
type Colors = { [K in keyof typeof lightColors]: string };

export const theme = { mode: 'light' as ThemeMode, colors: { ...lightColors } as Colors, radius: { control: 12, card: 16, large: 24, sm: 12, md: 20, lg: 28 }, spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 }, typography: { display: 32, title: 28, section: 18, body: 16, small: 14, caption: 12, amount: 28, pageTitle: 28, rowTitle: 16, supporting: 13, button: 15, status: 13 } };
type ThemeContextValue = { preference: AppearancePreference; mode: ThemeMode; ready: boolean; setPreference: (value: AppearancePreference) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<AppearancePreference>('light'); const [ready, setReady] = useState(false); const mode: ThemeMode = 'light';
  useEffect(() => { AsyncStorage.getItem(APPEARANCE_STORAGE_KEY).then((value) => { if (value === 'light' || value === 'dark' || value === 'system') setPreferenceState(value); }).catch(() => undefined).finally(() => setReady(true)); }, []);
  // The approved product visual system is light-only; avoid system dark mode
  // recoloring native controls or screens unexpectedly.
  theme.mode = 'light';
  Object.assign(theme.colors, lightColors);
  useEffect(() => { if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.style.colorScheme = mode; }, [mode]);
  useEffect(() => { if (Platform.OS === 'android') void SystemUI.setBackgroundColorAsync(theme.colors.canvas).catch(() => undefined); }, [mode]);
  const value = useMemo(() => ({ preference, mode, ready, setPreference: async (next: AppearancePreference) => { setPreferenceState(next); await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next).catch(() => undefined); } }), [preference, mode, ready]);
  return <ThemeContext.Provider value={value}>{ready ? children : null}</ThemeContext.Provider>;
}
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme must be used inside ThemeProvider'); return value; }

// Keep module-created styles tied to semantic tokens when the palette changes.
export function createThemeStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const entries = Object.entries(lightColors) as [keyof Colors, string][]; const tokenFor = (value: unknown) => entries.find(([, color]) => color === value)?.[0];
  const convert = (value: any): any => { if (Array.isArray(value)) return value.map(convert); if (!value || typeof value !== 'object') return value; const result: any = {}; for (const [key, child] of Object.entries(value)) { const token = tokenFor(child); if (token) Object.defineProperty(result, key, { enumerable: true, get: () => theme.colors[token] }); else result[key] = convert(child); } return result; };
  return convert(styles) as T;
}
