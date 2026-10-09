import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  asyncValues: new Map<string, string>(),
  secureValues: new Map<string, string>(),
  randomCall: 0,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => runtime.asyncValues.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { runtime.asyncValues.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { runtime.asyncValues.delete(key); }),
  },
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => {
    runtime.randomCall += 1;
    return new Uint8Array(length).fill(runtime.randomCall);
  }),
}));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
  getItemAsync: vi.fn(async (key: string) => runtime.secureValues.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { runtime.secureValues.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { runtime.secureValues.delete(key); }),
}));

import { getProtectedItem, removeLocalEncryptionKey, setProtectedItem } from "./secureLocalStorage";

describe("secureLocalStorage", () => {
  beforeEach(async () => {
    runtime.asyncValues.clear();
    runtime.secureValues.clear();
    runtime.randomCall = 0;
    await removeLocalEncryptionKey();
  });

  it("encrypts local values with authenticated encryption and decrypts them for the app", async () => {
    await setProtectedItem("document", JSON.stringify({ tenantName: "Test tenant", amount: "3000.00" }));
    const stored = runtime.asyncValues.get("document")!;
    expect(stored).toMatch(/^ryczalt-encrypted:v1:/);
    expect(stored).not.toContain("Test tenant");
    expect(stored).not.toContain("3000.00");
    await expect(getProtectedItem("document")).resolves.toBe(JSON.stringify({ tenantName: "Test tenant", amount: "3000.00" }));
  });

  it("uses a fresh nonce for every write and rejects corrupted ciphertext safely", async () => {
    await setProtectedItem("document", "private data");
    const first = runtime.asyncValues.get("document");
    await setProtectedItem("document", "private data");
    expect(runtime.asyncValues.get("document")).not.toBe(first);
    runtime.asyncValues.set("document", "ryczalt-encrypted:v1:AAAA:AAAA");
    await expect(getProtectedItem("document")).rejects.toThrow("Restore from your JSON backup");
  });
});
