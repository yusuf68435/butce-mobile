// Sessiz otomatik yedek. Her 7 günde bir kez (cihaz başına) document/backups/
// altına versiyonlu dosya yazar. Kullanıcı paylaşımı manuel kalır;
// bu yedek cihaz kaybında kayıp olur ama crash recovery / şüpheli silme'den
// önce son N güne kadar dönüş için kullanılabilir.

import * as FileSystem from "expo-file-system/legacy";
import { AppState } from "../store/types";
import { STATE_VERSION } from "./constants";

const DIR = FileSystem.documentDirectory + "auto-backups/";
export const MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const KEEP_LAST = 4; // tut son 4 yedek (~28 gün)

/** Pure decision: should we write a new auto-backup? */
export function shouldBackup(opts: {
  txCount: number;
  lastAt: number;
  now: number;
}): { write: boolean; reason: string } {
  if (opts.txCount === 0) return { write: false, reason: "no-data" };
  if (opts.now - opts.lastAt < MIN_INTERVAL_MS)
    return { write: false, reason: "too-soon" };
  return { write: true, reason: "ok" };
}

/** Pure: which backup file names to prune from a sorted-asc list. */
export function pruneTargets(
  backups: string[],
  keep: number = KEEP_LAST,
): string[] {
  if (backups.length <= keep) return [];
  return backups.slice(0, backups.length - keep);
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists)
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {}
}

export interface AutoBackupResult {
  wrote: boolean;
  path?: string;
  reason?: string;
}

export async function maybeWriteAutoBackup(
  state: AppState,
  now = Date.now(),
): Promise<AutoBackupResult> {
  try {
    await ensureDir();
    const stampPath = DIR + ".lastAt";
    let lastAt = 0;
    try {
      const raw = await FileSystem.readAsStringAsync(stampPath);
      const n = Number(raw);
      if (Number.isFinite(n)) lastAt = n;
    } catch {
      lastAt = 0;
    }
    const decision = shouldBackup({
      txCount: state.transactions.length,
      lastAt,
      now,
    });
    if (!decision.write) return { wrote: false, reason: decision.reason };
    const today = new Date(now).toISOString().slice(0, 10);
    const fileUri = `${DIR}backup-${today}.json`;
    const payload = {
      app: "ggai",
      version: STATE_VERSION,
      auto: true,
      exportedAt: new Date(now).toISOString(),
      state,
    };
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload));
    await FileSystem.writeAsStringAsync(stampPath, String(now));

    // Eski yedekleri budayalım — son KEEP_LAST hariç sil.
    try {
      const list = await FileSystem.readDirectoryAsync(DIR);
      const backups = list
        .filter((n) => n.startsWith("backup-") && n.endsWith(".json"))
        .sort();
      for (const name of pruneTargets(backups)) {
        try {
          await FileSystem.deleteAsync(DIR + name, { idempotent: true });
        } catch {}
      }
    } catch {}

    return { wrote: true, path: fileUri };
  } catch (e: unknown) {
    return {
      wrote: false,
      reason: e instanceof Error ? e.message : "io-error",
    };
  }
}

export async function listAutoBackups(): Promise<
  { name: string; uri: string; size: number; mtime?: number }[]
> {
  try {
    await ensureDir();
    const list = await FileSystem.readDirectoryAsync(DIR);
    const out: { name: string; uri: string; size: number; mtime?: number }[] =
      [];
    for (const name of list.sort().reverse()) {
      if (!name.startsWith("backup-") || !name.endsWith(".json")) continue;
      const uri = DIR + name;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          out.push({
            name,
            uri,
            size: (info as { size?: number }).size ?? 0,
            mtime: (info as { modificationTime?: number }).modificationTime,
          });
        }
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}
