// Lightweight on-device error log. AsyncStorage-backed ring buffer.
// Used by ErrorBoundary and ad-hoc try/catch sites that want diagnostic trail.
// Does NOT call out to any server — pure local.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ggai:errors:v1";
const MAX_ENTRIES = 25;

export interface ErrorEntry {
  at: string; // ISO
  source: string; // human source label, e.g. "ErrorBoundary", "fetchPrices"
  message: string;
  stack?: string;
}

let buffer: ErrorEntry[] | null = null;

async function loadBuffer(): Promise<ErrorEntry[]> {
  if (buffer) return buffer;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        buffer = parsed.filter(
          (x): x is ErrorEntry =>
            !!x &&
            typeof x === "object" &&
            typeof x.at === "string" &&
            typeof x.message === "string",
        );
        return buffer;
      }
    }
  } catch {}
  buffer = [];
  return buffer;
}

async function flush() {
  if (!buffer) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(buffer));
  } catch {}
}

/** Record an error. Best-effort, never throws. */
export async function logError(source: string, err: unknown): Promise<void> {
  try {
    const list = await loadBuffer();
    const entry: ErrorEntry = {
      at: new Date().toISOString(),
      source: String(source).slice(0, 80),
      message:
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "unknown",
      stack:
        err instanceof Error && typeof err.stack === "string"
          ? err.stack.slice(0, 4000)
          : undefined,
    };
    list.unshift(entry);
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    await flush();
  } catch {}
}

export async function readErrors(): Promise<ErrorEntry[]> {
  const list = await loadBuffer();
  return [...list];
}

export async function clearErrors(): Promise<void> {
  buffer = [];
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
