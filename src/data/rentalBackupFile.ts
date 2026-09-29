import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const BACKUP_MIME = "application/json";

export function rentalBackupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `ryczalt-backup-${stamp}.json`;
}

export async function saveRentalBackupFile(contents: string, now = new Date()): Promise<string> {
  const name = rentalBackupFilename(now);
  if (Platform.OS === "android") {
    const directory = await Directory.pickDirectoryAsync();
    const file = directory.createFile(name, BACKUP_MIME);
    file.write(contents);
    return file.uri;
  }

  // On iOS the app Documents directory is exposed in Files via the
  // expo-file-system config plugin. This keeps backup fully local.
  const file = new File(Paths.document, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return file.uri;
}

export async function pickRentalBackupContents(): Promise<string | null> {
  const picked = await File.pickFileAsync(undefined, BACKUP_MIME);
  const file = Array.isArray(picked) ? picked[0] : picked;
  return file ? file.text() : null;
}
