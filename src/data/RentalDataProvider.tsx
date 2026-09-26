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
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";
import { createSerializedMutationQueue } from "./serializedMutationQueue";

type RentalDataContextValue = {
  document: RentalDocument | null;
  error: string;
  update: (
    change: (current: RentalDocument) => RentalDocument,
  ) => Promise<void>;
};

const RentalDataContext = createContext<RentalDataContextValue | null>(null);

export function RentalDataProvider({ children }: PropsWithChildren) {
  const [document, setDocument] = useState<RentalDocument | null>(null);
  const [error, setError] = useState("");
  const documentRef = useRef<RentalDocument | null>(null);
  const mutationQueue = useRef(createSerializedMutationQueue());

  useEffect(() => {
    void loadRentalDocument()
      .then((loaded) => {
        documentRef.current = loaded;
        setDocument(loaded);
      })
      .catch(() => setError("Nie udało się odczytać danych lokalnych."));
  }, []);

  const update = useCallback(
    async (change: (current: RentalDocument) => RentalDocument) => {
      return mutationQueue.current(async () => {
        const current = documentRef.current;
        if (!current) throw new Error("Rental document is still loading.");
        const next = change(current);
        try {
          await saveRentalDocument(next);
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
    () => ({ document, error, update }),
    [document, error, update],
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
