import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  emptyDocument,
  loadRentalDocument,
  readRawRentalDocument,
  resetRentalDocument,
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";
import { createSerializedMutationQueue } from "./serializedMutationQueue";
import { persistRentalMutation } from "./persistRentalMutation";

type RentalDataContextValue = {
  document: RentalDocument | null;
  error: string;
  loadError: string;
  retryLoad: () => Promise<void>;
  copyRawData: () => Promise<string | null>;
  resetLocalData: () => Promise<void>;
  update: (
    change: (current: RentalDocument) => RentalDocument,
  ) => Promise<void>;
};

const RentalDataContext = createContext<RentalDataContextValue | null>(null);

export function RentalDataProvider({ children }: PropsWithChildren) {
  const [document, setDocument] = useState<RentalDocument | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const documentRef = useRef<RentalDocument | null>(null);
  const mutationQueue = useRef(createSerializedMutationQueue());

  const retryLoad = useCallback(async () => {
    try {
      const loaded = await loadRentalDocument();
      documentRef.current = loaded;
      setDocument(loaded);
      setLoadError("");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Nie udało się odczytać danych lokalnych.");
    }
  }, []);

  useEffect(() => { void retryLoad(); }, [retryLoad]);

  const copyRawData = useCallback(() => readRawRentalDocument(), []);
  const resetLocalData = useCallback(async () => {
    await resetRentalDocument();
    const empty = emptyDocument();
    documentRef.current = empty;
    setDocument(empty);
    setError("");
    setLoadError("");
  }, []);

  const update = useCallback(
    async (change: (current: RentalDocument) => RentalDocument) => {
      return mutationQueue.current(async () => {
        const current = documentRef.current;
        if (!current) throw new Error("Rental document is still loading.");
        try {
          const next = await persistRentalMutation(current, change, saveRentalDocument);
          documentRef.current = next;
          setDocument(next);
          setError("");
        } catch {
          setError("Nie udało się zapisać zmian. Spróbuj ponownie.");
          throw new Error("Rental document could not be saved.");
        }
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ document, error, loadError, retryLoad, copyRawData, resetLocalData, update }),
    [document, error, loadError, retryLoad, copyRawData, resetLocalData, update],
  );
  return (
    <RentalDataContext.Provider value={value}>
      {children}
    </RentalDataContext.Provider>
  );
}

export function useRentalData() {
  const value = useContext(RentalDataContext);
  if (!value)
    throw new Error("useRentalData must be used inside RentalDataProvider");
  return value;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export { emptyDocument };
