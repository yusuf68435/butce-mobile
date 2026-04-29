// Lightweight wrapper around expo-notifications.
// Gracefully no-ops if the package isn't installed yet.
// To enable: `npx expo install expo-notifications` then rebuild dev client.

import { Recurring } from "../store/types";
import { nextDueOf } from "../store/selectors";
import { fmtTRY } from "./format";

type NotifModule = {
  setNotificationHandler: (h: unknown) => void;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  scheduleNotificationAsync: (req: unknown) => Promise<string>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  AndroidImportance?: Record<string, number>;
};

let mod: NotifModule | null = null;
let inited = false;

function load(): NotifModule | null {
  if (inited) return mod;
  inited = true;
  try {
    mod = require("expo-notifications");
    if (mod) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    }
  } catch {
    mod = null;
  }
  return mod;
}

export async function ensurePermissions(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    const cur = await m.getPermissionsAsync();
    if (cur.status === "granted") return true;
    const req = await m.requestPermissionsAsync();
    return req.status === "granted";
  } catch {
    return false;
  }
}

export async function cancelAll(): Promise<void> {
  const m = load();
  if (!m) return;
  try {
    await m.cancelAllScheduledNotificationsAsync();
  } catch {}
}

function dateAtTime(iso: string, hour: number, minute: number): Date {
  const hh = String(Math.max(0, Math.min(23, Math.floor(hour)))).padStart(
    2,
    "0",
  );
  const mm = String(Math.max(0, Math.min(59, Math.floor(minute)))).padStart(
    2,
    "0",
  );
  return new Date(`${iso}T${hh}:${mm}:00`);
}

export async function scheduleRecurringReminders(
  recurring: Recurring[],
  hour = 9,
  minute = 0,
): Promise<void> {
  const m = load();
  if (!m) return;
  const ok = await ensurePermissions();
  if (!ok) return;
  await cancelAll();
  const now = Date.now();
  for (const r of recurring) {
    if (!r.active) continue;
    const due = nextDueOf(r);
    const at = dateAtTime(due, hour, minute);
    if (at.getTime() <= now) continue;
    try {
      await m.scheduleNotificationAsync({
        content: {
          title: r.type === "expense" ? "Ödeme zamanı" : "Tahsilat",
          body: `${r.name} • ${fmtTRY(r.amount)}`,
        },
        trigger: { date: at },
      });
    } catch {}
  }
}

export async function scheduleBudgetAlert(
  category: string,
  pct: number,
): Promise<void> {
  const m = load();
  if (!m) return;
  const ok = await ensurePermissions();
  if (!ok) return;
  try {
    await m.scheduleNotificationAsync({
      content: {
        title: pct >= 100 ? "Bütçe aşıldı" : "Bütçeye yaklaşıyor",
        body: `${category} • %${Math.round(pct)}`,
      },
      trigger: null,
    });
  } catch {}
}

export function isAvailable(): boolean {
  return load() !== null;
}
