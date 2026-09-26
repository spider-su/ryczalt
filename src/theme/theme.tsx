import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { resolveThemeMode, type AppearancePreference, type ThemeMode } from './appearance';
export type { AppearancePreference, ThemeMode } from './appearance';

export const APPEARANCE_STORAGE_KEY = 'ryczalt.ui.appearance';

const lightColors = {
  canvas: '#F5F7FC', background: '#F5F7FC', surface: '#FFFFFF', surfaceSecondary: '#EEF3F8', surfaceElevated: '#FFFFFF', surfaceMuted: '#F0F4F8',
  textPrimary: '#152238', textSecondary: '#516176', textMuted: '#718096', borderSubtle: '#DCE4ED', divider: '#E7EDF3', interactive: '#C52632', accent: '#C52632', accentPressed: '#A61E29', accentSoft: '#FCECEE',
  success: '#18794E', successSoft: '#E8F6EE', warning: '#9A6700', warningSoft: '#FFF5D6', danger: '#B42318', dangerSoft: '#FDEDEC', info: '#C52632', infoSoft: '#FCECEE', onAccent: '#FFFFFF', overlay: '#15223866', inputBackground: '#FFFFFF', inputBorder: '#DCE4ED', disabled: '#A8B3C2', focusRing: '#C52632', selectedNavigation: '#C52632', inactiveNavigation: '#718096', modalBackground: '#FFFFFF',
  text: '#152238', border: '#DCE4ED', primary: '#C52632', primarySoft: '#FCECEE'
} as const;
type Colors = { [K in keyof typeof lightColors]: string };
const darkColors: Colors = { ...lightColors, canvas: '#0F1724', background: '#0F1724', surface: '#172235', surfaceSecondary: '#202E42', surfaceElevated: '#1B2A3E', surfaceMuted: '#1C293B', textPrimary: '#F3F6FA', textSecondary: '#B4C0D0', textMuted: '#8493A8', borderSubtle: '#304158', divider: '#26364C', accent: '#FF8890', interactive: '#FF8890', accentPressed: '#FFAFB4', accentSoft: '#51252D', success: '#63D69C', successSoft: '#163D31', warning: '#F2C96D', warningSoft: '#453817', danger: '#FF8F86', dangerSoft: '#482321', info: '#8EB9FF', infoSoft: '#51252D', onAccent: '#07111F', overlay: '#00000066', inputBackground: '#172235', inputBorder: '#3A4B63', disabled: '#66758A', focusRing: '#8EB9FF', selectedNavigation: '#8EB9FF', inactiveNavigation: '#8493A8', modalBackground: '#172235', text: '#F3F6FA', border: '#304158', primary: '#FF8890', primarySoft: '#51252D' };

export const theme = { mode: 'light' as ThemeMode, colors: { ...lightColors } as Colors, radius: { control: 12, card: 16, large: 24, sm: 12, md: 20, lg: 28 }, spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 }, typography: { display: 32, title: 28, section: 18, body: 16, small: 14, caption: 12, amount: 28, pageTitle: 28, rowTitle: 16, supporting: 13, button: 15, status: 13 } };
type ThemeContextValue = { preference: AppearancePreference; mode: ThemeMode; ready: boolean; setPreference: (value: AppearancePreference) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme(); const [preference, setPreferenceState] = useState<AppearancePreference>('system'); const [ready, setReady] = useState(false); const mode = resolveThemeMode(preference, systemScheme);
  useEffect(() => { AsyncStorage.getItem(APPEARANCE_STORAGE_KEY).then((value) => { if (value === 'light' || value === 'dark' || value === 'system') setPreferenceState(value); }).catch(() => undefined).finally(() => setReady(true)); }, []);
  // Apply synchronously so persisted Dark mode is already present during the
  // first render after storage hydration; this prevents light-only surfaces
  // from being captured by screens that preserve their navigation state.
  theme.mode = mode;
  Object.assign(theme.colors, mode === 'dark' ? darkColors : lightColors);
  useEffect(() => { if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.style.colorScheme = mode; }, [mode]);
  useEffect(() => { if (Platform.OS === 'android') void SystemUI.setBackgroundColorAsync(theme.colors.canvas).catch(() => undefined); }, [mode]);
  const value = useMemo(() => ({ preference, mode, ready, setPreference: async (next: AppearancePreference) => { setPreferenceState(next); await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next).catch(() => undefined); } }), [preference, mode, ready]);
  return <ThemeContext.Provider value={value}>{ready ? children : null}</ThemeContext.Provider>;
}
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme must be used inside ThemeProvider'); return value; }

// Keep module-created styles tied to semantic tokens when the palette changes.
export function createThemeStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const entries = [...Object.entries(lightColors), ...Object.entries(darkColors)] as [keyof Colors, string][]; const tokenFor = (value: unknown) => entries.find(([, color]) => color === value)?.[0];
  const convert = (value: any): any => { if (Array.isArray(value)) return value.map(convert); if (!value || typeof value !== 'object') return value; const result: any = {}; for (const [key, child] of Object.entries(value)) { const token = tokenFor(child); if (token) Object.defineProperty(result, key, { enumerable: true, get: () => theme.colors[token] }); else result[key] = convert(child); } return result; };
  return convert(styles) as T;
}
