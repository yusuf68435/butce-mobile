// Defansif haptics wrapper. Modül yoksa sessizce no-op.

type HapticsModule = {
  impactAsync: (style: number) => Promise<void>;
  notificationAsync: (type: number) => Promise<void>;
  selectionAsync: () => Promise<void>;
  ImpactFeedbackStyle: {
    Light: number;
    Medium: number;
    Heavy: number;
    Soft: number;
    Rigid: number;
  };
  NotificationFeedbackType: { Success: number; Warning: number; Error: number };
};

let mod: HapticsModule | null = null;
let inited = false;

function load(): HapticsModule | null {
  if (inited) return mod;
  inited = true;
  try {
    mod = require("expo-haptics");
  } catch {
    mod = null;
  }
  return mod;
}

export function tapLight() {
  const m = load();
  if (!m) return;
  m.impactAsync(m.ImpactFeedbackStyle.Light).catch(() => {});
}

export function tapSoft() {
  const m = load();
  if (!m) return;
  m.impactAsync(m.ImpactFeedbackStyle.Soft).catch(() => {});
}

export function tapMedium() {
  const m = load();
  if (!m) return;
  m.impactAsync(m.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function selectionTap() {
  const m = load();
  if (!m) return;
  m.selectionAsync().catch(() => {});
}

export function notifySuccess() {
  const m = load();
  if (!m) return;
  m.notificationAsync(m.NotificationFeedbackType.Success).catch(() => {});
}

export function notifyWarning() {
  const m = load();
  if (!m) return;
  m.notificationAsync(m.NotificationFeedbackType.Warning).catch(() => {});
}

export function notifyError() {
  const m = load();
  if (!m) return;
  m.notificationAsync(m.NotificationFeedbackType.Error).catch(() => {});
}
