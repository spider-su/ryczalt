export type AppearancePreference = 'light' | 'dark' | 'system';
export type ThemeMode = 'light' | 'dark';

export function resolveThemeMode(preference: AppearancePreference, system: 'light' | 'dark' | 'unspecified' | null | undefined): ThemeMode {
  return preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
}
