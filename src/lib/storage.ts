// On-device storage usage breakdown.
// Pure helpers + IO probe for receipts/ and auto-backups/ folders.

import * as FileSystem from "expo-file-system/legacy";

const RECEIPT_DIR = FileSystem.documentDirectory + "receipts/";
const BACKUP_DIR = FileSystem.documentDirectory + "auto-backups/";

export interface StorageUsage {
  receiptsBytes: number;
  receiptsCount: number;
  backupsBytes: number;
  backupsCount: number;
  totalBytes: number;
}

async function dirSize(dir: string): Promise<{ bytes: number; count: number }> {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return { bytes: 0, count: 0 };
    const list = await FileSystem.readDirectoryAsync(dir);
    let bytes = 0;
    let count = 0;
    for (const name of list) {
      try {
        const fi = await FileSystem.getInfoAsync(dir + name);
        if (fi.exists) {
          bytes += (fi as { size?: number }).size ?? 0;
          count += 1;
        }
      } catch {}
    }
    return { bytes, count };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

export async function probeStorage(): Promise<StorageUsage> {
  const [receipts, backups] = await Promise.all([
    dirSize(RECEIPT_DIR),
    dirSize(BACKUP_DIR),
  ]);
  return {
    receiptsBytes: receipts.bytes,
    receiptsCount: receipts.count,
    backupsBytes: backups.bytes,
    backupsCount: backups.count,
    totalBytes: receipts.bytes + backups.bytes,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
