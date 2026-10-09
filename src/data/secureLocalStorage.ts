import AsyncStorage from "@react-native-async-storage/async-storage";
import { gcm } from "@noble/ciphers/aes.js";
import { Platform } from "react-native";

const KEY_ID = "pl.ryczalt.rental.document-encryption-key.v1";
const PREFIX = "ryczalt-encrypted:v1:";
const AAD = new TextEncoder().encode("pl.ryczalt.rental.local-document.v1");
const keyOptions = async () => {
  const SecureStore = await import("expo-secure-store");
  return { module: SecureStore, options: { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } };
};

async function randomBytes(count: number): Promise<Uint8Array> {
  const Crypto = await import("expo-crypto");
  return Crypto.getRandomBytesAsync(count);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

let keyPromise: Promise<Uint8Array> | null = null;
async function encryptionKey(): Promise<Uint8Array> {
  if (!keyPromise) keyPromise = readOrCreateEncryptionKey();
  try { return await keyPromise; } catch (error) { keyPromise = null; throw error; }
}

async function readOrCreateEncryptionKey(): Promise<Uint8Array> {
  const { module: SecureStore, options } = await keyOptions();
  let encoded = await SecureStore.getItemAsync(KEY_ID, options);
  if (encoded === null) {
    const candidate = bytesToBase64(await randomBytes(32));
    await SecureStore.setItemAsync(KEY_ID, candidate, options);
    // Another startup may have initialized the key concurrently; always use the stored winner.
    encoded = await SecureStore.getItemAsync(KEY_ID, options);
  }
  if (encoded === null) throw new Error("Local encryption key is unavailable.");
  const key = base64ToBytes(encoded);
  if (key.length !== 32) throw new Error("Local encryption key is invalid.");
  return key;
}

/** Encrypts local documents on native devices. Web storage remains browser-managed. */
export async function getProtectedItem(key: string): Promise<string | null> {
  const stored = await AsyncStorage.getItem(key);
  if (stored === null || Platform.OS === "web" || !stored.startsWith(PREFIX)) return stored;
  try {
    const [nonceText, cipherText] = stored.slice(PREFIX.length).split(":");
    if (!nonceText || !cipherText) throw new Error("Malformed encrypted document.");
    const clear = gcm(await encryptionKey(), base64ToBytes(nonceText), AAD).decrypt(base64ToBytes(cipherText));
    return new TextDecoder().decode(clear);
  } catch {
    throw new Error("Encrypted local data cannot be opened on this device. Restore from your JSON backup.");
  }
}

export async function setProtectedItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  const nonce = await randomBytes(12);
  const cipher = gcm(await encryptionKey(), nonce, AAD).encrypt(new TextEncoder().encode(value));
  await AsyncStorage.setItem(key, `${PREFIX}${bytesToBase64(nonce)}:${bytesToBase64(cipher)}`);
}

export async function removeProtectedItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function removeLocalEncryptionKey(): Promise<void> {
  const { module: SecureStore, options } = await keyOptions();
  await SecureStore.deleteItemAsync(KEY_ID, options);
  keyPromise = null;
}

export const isEncryptedLocalValue = (value: string | null) => value?.startsWith(PREFIX) ?? false;
