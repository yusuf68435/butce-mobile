import * as FileSystem from "expo-file-system/legacy";

const DIR = FileSystem.documentDirectory + "receipts/";

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists)
      await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {}
}

function extOf(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]{2,5})(\?|$)/);
  return m ? m[1].toLowerCase() : "jpg";
}

/**
 * Resize + recompress a photo through expo-image-manipulator.
 * Side effects: drops EXIF (including GPS), drops alpha, caps dimension to
 * 1600px, recompresses to JPEG q=0.7. Falls back to plain copy if module
 * isn't available.
 */
async function sanitize(srcUri: string): Promise<string | null> {
  try {
    const mod =
      require("expo-image-manipulator") as typeof import("expo-image-manipulator");
    const result = await mod.manipulateAsync(
      srcUri,
      [{ resize: { width: 1600 } }],
      {
        compress: 0.7,
        format: mod.SaveFormat.JPEG,
      },
    );
    return result.uri;
  } catch {
    return null;
  }
}

export async function persistPhoto(srcUri: string): Promise<string | null> {
  try {
    await ensureDir();
    // Sanitize first (strip EXIF, recompress). If it fails we fall back to
    // copying the raw file — better to keep the user's photo than to lose it.
    const sanitized = await sanitize(srcUri);
    const sourceForCopy = sanitized ?? srcUri;
    const ext = sanitized ? "jpg" : extOf(srcUri);
    const dest = `${DIR}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await FileSystem.copyAsync({ from: sourceForCopy, to: dest });
    // Best-effort: delete the temp sanitized intermediate to avoid orphans
    // in cache. Failures are silent.
    if (sanitized) {
      try {
        await FileSystem.deleteAsync(sanitized, { idempotent: true });
      } catch {}
    }
    return dest;
  } catch {
    return null;
  }
}

export async function deletePhoto(uri: string): Promise<void> {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}

export function isLocalPhoto(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith(FileSystem.documentDirectory ?? "");
}

/**
 * Pure decision: which filenames in the receipts dir are orphaned?
 * Exported for test coverage; the IO version below uses this internally.
 */
export function orphanFilenames(
  presentFilenames: string[],
  keepUris: Iterable<string | null | undefined>,
  dirPrefix: string,
): string[] {
  const keep = new Set<string>();
  for (const u of keepUris) {
    if (u && u.startsWith(dirPrefix)) keep.add(u.slice(dirPrefix.length));
  }
  return presentFilenames.filter((n) => !keep.has(n));
}

/**
 * Sweep receipts/ for files no longer referenced in `keepUris`.
 * Returns count of deleted files. Pure best-effort; never throws.
 */
export async function sweepOrphanPhotos(
  keepUris: Iterable<string | null | undefined>,
): Promise<{ deleted: number; total: number }> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) return { deleted: 0, total: 0 };
    const list = await FileSystem.readDirectoryAsync(DIR);
    const orphans = orphanFilenames(list, keepUris, DIR);
    let deleted = 0;
    for (const name of orphans) {
      try {
        await FileSystem.deleteAsync(DIR + name, { idempotent: true });
        deleted += 1;
      } catch {}
    }
    return { deleted, total: list.length };
  } catch {
    return { deleted: 0, total: 0 };
  }
}
