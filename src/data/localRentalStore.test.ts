import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RENTAL_DOCUMENT_STORAGE_KEY,
  RentalStoreError,
  emptyDocument,
  loadRentalDocument,
  saveRentalDocument
} from './localRentalStore';
import type { RentalDocument } from '../model/rental';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}));

const storage = vi.mocked(AsyncStorage);

const validDocument: RentalDocument = {
  schemaVersion: 1,
  properties: [
    {
      id: 'property-1',
      name: 'Mieszkanie testowe',
      defaultMonthlyRent: '2500.00'
    }
  ],
  incomeEntries: [
    {
      id: 'income-1',
      propertyId: 'property-1',
      receivedAt: '2026-09-10',
      amount: '2500.00',
      taxableAmount: '2500.00',
      rentalMonth: '2026-09'
    }
  ],
  taxPayments: [
    {
      id: 'tax-1',
      period: '2026-09',
      paidAt: '2026-10-20',
      amount: '212.50'
    }
  ],
  settings: { taxYear: 2026 }
};

describe('localRentalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty versioned document when storage is empty', async () => {
    storage.getItem.mockResolvedValueOnce(null);

    await expect(loadRentalDocument()).resolves.toEqual(emptyDocument());
  });

  it('loads a valid document without changing decimal-string amounts', async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(validDocument));

    await expect(loadRentalDocument()).resolves.toEqual(validDocument);
  });

  it('reports invalid JSON as corrupted data', async () => {
    storage.getItem.mockResolvedValueOnce('{not-json');

    await expect(loadRentalDocument()).rejects.toMatchObject({ code: 'CORRUPTED_DATA' } satisfies Partial<RentalStoreError>);
  });

  it('rejects unsupported schema versions', async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify({ ...validDocument, schemaVersion: 2 }));

    await expect(loadRentalDocument()).rejects.toMatchObject({ code: 'UNSUPPORTED_VERSION' } satisfies Partial<RentalStoreError>);
  });

  it('validates and saves the document to the rental namespace', async () => {
    storage.setItem.mockResolvedValueOnce();

    await saveRentalDocument(validDocument);

    expect(storage.setItem).toHaveBeenCalledWith(RENTAL_DOCUMENT_STORAGE_KEY, JSON.stringify(validDocument));
  });
});
