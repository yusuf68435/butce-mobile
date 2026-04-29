// Migration framework. Each migration takes a partial state from version N
// and returns a state at version N+1. Run on hydrate.

import { DEFAULT_CATEGORIES } from "../lib/constants";

export const CURRENT_VERSION = 4;

interface VersionedRecord {
  __v?: number;
  [key: string]: unknown;
}

type MigrationFn = (state: VersionedRecord) => VersionedRecord;

// IMPORTANT: keep migrations append-only. Never edit a past migration after
// release; write a new one for any further fix.
const migrations: Record<number, MigrationFn> = {
  // 0 → 1: initial shape. Treat any unversioned legacy state as v1.
  1: (s) => {
    const next: VersionedRecord = { ...s };
    next.transactions = Array.isArray(s.transactions) ? s.transactions : [];
    next.pending = Array.isArray(s.pending) ? s.pending : [];
    next.silver = Array.isArray(s.silver) ? s.silver : [];
    next.recurring = Array.isArray(s.recurring) ? s.recurring : [];
    next.goals = Array.isArray(s.goals) ? s.goals : [];
    next.categories = (s.categories as unknown) || {
      income: [...DEFAULT_CATEGORIES.income],
      expense: [...DEFAULT_CATEGORIES.expense],
    };
    next.settings = (s.settings as unknown) || {};
    next.__v = 1;
    return next;
  },
  // 1 → 2: introduces assets/debts/wallets arrays + default settings.
  2: (s) => {
    const settings = (s.settings as Record<string, unknown>) || {};
    return {
      ...s,
      assets: Array.isArray(s.assets) ? s.assets : [],
      debts: Array.isArray(s.debts) ? s.debts : [],
      wallets: Array.isArray(s.wallets) ? s.wallets : [],
      settings: {
        notifyHour: 9,
        notifyMinute: 0,
        ...settings,
      },
      __v: 2,
    };
  },
  // 2 → 3: introduces templates array.
  3: (s) => ({
    ...s,
    templates: Array.isArray(s.templates) ? s.templates : [],
    __v: 3,
  }),
  // 3 → 4: Personal Edition diet.
  //   • Silver positions migrated into Assets as kind="silver"
  //   • Drop Wallet array (never used in UI)
  //   • Drop themeOverride / defaultTab from settings (system default)
  //   • Drop "stock" assets (Yahoo Finance dependency unstable)
  4: (s) => {
    const next: VersionedRecord = { ...s };
    const assetsArr = Array.isArray(s.assets) ? [...s.assets] : [];
    const silverArr = Array.isArray(s.silver) ? s.silver : [];

    // Convert silver positions into assets.
    const gramPrice =
      Number((s.settings as Record<string, unknown>)?.silverGramPrice) || 0;
    for (const raw of silverArr) {
      const p = raw as Record<string, unknown>;
      const amount = Number(p.amount) || 0;
      if (amount <= 0) continue;
      // gram or ounce: store gram-equivalent for simplicity
      const isOunce = p.kind === "ounce";
      const grams = isOunce ? amount * 31.1035 : amount;
      const buyPrice = Number(p.buyPrice) || 0;
      const cur =
        Number(p.currentPrice) > 0 ? Number(p.currentPrice) : gramPrice;
      assetsArr.push({
        id: String(p.id ?? `silver-${Date.now()}-${Math.random()}`),
        name: isOunce ? "Gümüş (ons→gram)" : "Gümüş",
        kind: "silver",
        amount: grams,
        buyPrice: isOunce ? buyPrice / 31.1035 : buyPrice,
        currentPrice: cur > 0 ? cur : null,
        buyDate: p.buyDate ?? null,
      });
    }

    // Drop "stock" kind assets (data preserved in __droppedStocks for safety).
    const stocks = assetsArr.filter(
      (a) => (a as { kind?: string }).kind === "stock",
    );
    const cleanedAssets = assetsArr.filter(
      (a) => (a as { kind?: string }).kind !== "stock",
    );

    next.assets = cleanedAssets;
    next.silver = []; // legacy field zeroed; readers no longer reference it
    delete next.wallets;

    const settings = { ...((s.settings as Record<string, unknown>) || {}) };
    delete settings.themeOverride;
    delete settings.defaultTab;
    next.settings = settings;

    if (stocks.length > 0) next.__droppedStocks = stocks;

    next.__v = 4;
    return next;
  },
};

export function migrate(raw: unknown): {
  state: VersionedRecord;
  changed: boolean;
} {
  const obj: VersionedRecord =
    raw && typeof raw === "object" ? { ...(raw as VersionedRecord) } : {};
  let v = typeof obj.__v === "number" ? obj.__v : 0;
  let state = obj;
  const startV = v;
  while (v < CURRENT_VERSION) {
    const fn = migrations[v + 1];
    if (!fn) break;
    state = fn(state);
    v += 1;
  }
  return { state, changed: v !== startV };
}
