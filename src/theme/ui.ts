import { Platform } from 'react-native';
import { theme } from './theme';

/** Shared presentation primitives for the calm light mobile interface. */
export const ui = {
  page: { flex: 1, backgroundColor: theme.colors.canvas },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 16,
    marginVertical: 6,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(23, 32, 51, 0.045)' },
      default: { shadowColor: '#172033', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    }),
    elevation: 1,
  },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700' as const, marginTop: 22, marginBottom: 8 },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    minHeight: 48,
    borderRadius: 13,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 20,
    marginVertical: 8,
  },
};
