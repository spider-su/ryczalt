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
  loadRentalDocumentWithStatus,
  readRawRentalDocument,
  resetRentalDocument,
  saveRentalDocument,
} from "./localRentalStore";
import type { RentalDocument } from "../model/rental";
import { createSerializedMutationQueue } from "./serializedMutationQueue";
import { persistRentalMutation } from "./persistRentalMutation";
import { applyRentalDocumentChange, createDemoRentalDocument } from "./demoRentalDocument";

type RentalDataContextValue = {
  document: RentalDocument | null;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  error: string;
  loadError: string;
  recoveredFromBackup: boolean;
  dismissRecoveryNotice: () => void;
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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [recoveredFromBackup, setRecoveredFromBackup] = useState(false);
  const documentRef = useRef<RentalDocument | null>(null);
  const realDocumentRef = useRef<RentalDocument | null>(null);
  const demoDocumentRef = useRef<RentalDocument | null>(null);
  const isDemoModeRef = useRef(false);
  const mutationQueue = useRef(createSerializedMutationQueue());

  const retryLoad = useCallback(async () => {
    try {
      const loaded = await loadRentalDocumentWithStatus();
      realDocumentRef.current = loaded.document;
      isDemoModeRef.current = false;
      setIsDemoMode(false);
      documentRef.current = loaded.document;
      setDocument(loaded.document);
      setRecoveredFromBackup(loaded.recoveredFromBackup);
      setLoadError("");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Nie udało się odczytać danych lokalnych.");
    }
  }, []);

  useEffect(() => { void retryLoad(); }, [retryLoad]);

  const copyRawData = useCallback(() => readRawRentalDocument(), []);
  const enterDemoMode = useCallback(() => {
    if (!realDocumentRef.current) return;
    const demo = createDemoRentalDocument();
    demoDocumentRef.current = demo;
    documentRef.current = demo;
    isDemoModeRef.current = true;
    setIsDemoMode(true);
    setDocument(demo);
    setError("");
    setLoadError("");
  }, []);
  const exitDemoMode = useCallback(() => {
    const real = realDocumentRef.current;
    if (!isDemoModeRef.current || !real) return;
    isDemoModeRef.current = false;
    demoDocumentRef.current = null;
    documentRef.current = real;
    setIsDemoMode(false);
    setDocument(real);
    setError("");
  }, []);
  const dismissRecoveryNotice = useCallback(() => setRecoveredFromBackup(false), []);
  const resetLocalData = useCallback(async () => {
    if (isDemoModeRef.current) {
      const emptyDemo = emptyDocument();
      demoDocumentRef.current = emptyDemo;
      documentRef.current = emptyDemo;
      setDocument(emptyDemo);
      setError("");
      setLoadError("");
      return;
    }
    await resetRentalDocument();
    const empty = emptyDocument();
    realDocumentRef.current = empty;
    documentRef.current = empty;
    setDocument(empty);
    setError("");
    setLoadError("");
    setRecoveredFromBackup(false);
  }, []);

  const update = useCallback(
    async (change: (current: RentalDocument) => RentalDocument) => {
      const requestedInDemo = isDemoModeRef.current;
      return mutationQueue.current(async () => {
        const current = requestedInDemo ? demoDocumentRef.current : realDocumentRef.current;
        if (!current) throw new Error("Rental document is still loading.");
        try {
          // Drop queued demo-only changes if the user left demo before they reached the serialized queue.
          if (requestedInDemo && !isDemoModeRef.current) return;
          const next = await applyRentalDocumentChange(current, change, requestedInDemo, async (changed) => {
            const persisted = await persistRentalMutation(current, () => changed, saveRentalDocument);
            realDocumentRef.current = persisted;
          });
          if (isDemoModeRef.current) demoDocumentRef.current = next;
          else realDocumentRef.current = next;
          if (isDemoModeRef.current === requestedInDemo) {
            documentRef.current = next;
            setDocument(next);
          }
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
    () => ({ document, isDemoMode, enterDemoMode, exitDemoMode, error, loadError, recoveredFromBackup, dismissRecoveryNotice, retryLoad, copyRawData, resetLocalData, update }),
    [document, isDemoMode, enterDemoMode, exitDemoMode, error, loadError, recoveredFromBackup, dismissRecoveryNotice, retryLoad, copyRawData, resetLocalData, update],
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
