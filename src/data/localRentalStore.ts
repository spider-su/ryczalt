import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RentalDocument } from '../model/rental';
const KEY = 'ryczalt.rental.document.v1';
export const emptyDocument = (): RentalDocument => ({ schemaVersion: 1, properties: [], incomeEntries: [], taxPayments: [], settings: { taxYear: new Date().getFullYear() } });
export async function loadRentalDocument(): Promise<RentalDocument> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return emptyDocument();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('schemaVersion' in data) || data.schemaVersion !== 1) throw new Error('Unsupported rental document version');
  return data as RentalDocument;
}
export async function saveRentalDocument(document: RentalDocument): Promise<void> {
  if (document.schemaVersion !== 1) throw new Error('Unsupported rental document version');
  await AsyncStorage.setItem(KEY, JSON.stringify(document));
}
