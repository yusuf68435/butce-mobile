import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "./types";
import { DEFAULT_CATEGORIES, STORAGE_KEY } from "../lib/constants";
import { chargeDueRecurring } from "./selectors";
import { CURRENT_VERSION, migrate } from "./migrations";
import { maybeWriteAutoBackup } from "../lib/autoBackup";
import { sweepOrphanPhotos } from "../lib/photos";
import { logError } from "../lib/errorLog";

function fresh(): AppState {
  return {
    transactions: [],
    pending: [],
    recurring: [],
    goals: [],
    assets: [],
    debts: [],
    templates: [],
    categories: {
      income: [...DEFAULT_CATEGORIES.income],
      expense: [...DEFAULT_CATEGORIES.expense],
    },
    settings: {},
  };
}

function normalize(raw: unknown): AppState {
  const { state: p } = migrate(raw);
  const obj = p as Record<string, unknown>;
  return {
    transactions: (obj.transactions as AppState["transactions"]) || [],
    pending: (obj.pending as AppState["pending"]) || [],
    recurring: (obj.recurring as AppState["recurring"]) || [],
    goals: (obj.goals as AppState["goals"]) || [],
    assets: (obj.assets as AppState["assets"]) || [],
    debts: (obj.debts as AppState["debts"]) || [],
    templates: (obj.templates as AppState["templates"]) || [],
    categories: {
      income: (obj.categories as { income?: string[] })?.income || [
        ...DEFAULT_CATEGORIES.income,
      ],
      expense: (obj.categories as { expense?: string[] })?.expense || [
        ...DEFAULT_CATEGORIES.expense,
      ],
    },
    settings: (obj.settings as AppState["settings"]) || {},
  };
}

let state: AppState = fresh();
let hydrated = false;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

async function persist() {
  try {
    const versioned = { ...state, __v: CURRENT_VERSION };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(versioned));
  } catch (e) {
    // Persist failure = potential data loss. Log so user can see in Diagnostics.
    logError("Store.persist", e).catch(() => {});
  }
}

let hydrationFailed = false;

export function didHydrationFail(): boolean {
  return hydrationFailed;
}

export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        state = normalize(JSON.parse(raw));
      } catch (e) {
        // Parse/migrate failure: state stays at fresh(), but flag it.
        // User's existing data remains in AsyncStorage untouched (we didn't
        // write yet). This way a future bug fix can recover.
        hydrationFailed = true;
        logError("Store.hydrate.parse", e).catch(() => {});
      }
    }
  } catch (e) {
    hydrationFailed = true;
    logError("Store.hydrate.read", e).catch(() => {});
  }
  // Don't run charge-due-recurring on a failed hydrate; we'd just churn fresh state.
  if (!hydrationFailed) {
    const charged = chargeDueRecurring(state);
    if (charged.txCreated > 0) {
      persist();
    }
  }
  hydrated = true;
  emit();
  // Fire-and-forget silent auto-backup. Doesn't block first paint.
  setTimeout(() => {
    maybeWriteAutoBackup(state).catch(() => {});
  }, 1500);
  // Cleanup orphaned receipts (transactions deleted out-of-band).
  setTimeout(() => {
    sweepOrphanPhotos(state.transactions.map((t) => t.photoUri)).catch(
      () => {},
    );
  }, 3000);
}

export const Store = {
  get state() {
    return state;
  },
  get isHydrated() {
    return hydrated;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  update(mutator: (s: AppState) => void) {
    mutator(state);
    persist();
    emit();
  },
  replace(next: AppState) {
    state = normalize(next);
    persist();
    emit();
    // Drop receipts that no longer belong to any tx in the new state.
    setTimeout(() => {
      sweepOrphanPhotos(state.transactions.map((t) => t.photoUri)).catch(
        () => {},
      );
    }, 100);
  },
  reset() {
    state = fresh();
    persist();
    emit();
    setTimeout(() => {
      // After reset, no tx → all receipts are orphaned.
      sweepOrphanPhotos([]).catch(() => {});
    }, 100);
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  // Subscribe to version (always changes on emit), then read state freshly.
  // This makes mutate-in-place patterns (e.g. s.transactions.push) safe,
  // because we don't compare snapshot identity of the slice — we compare
  // a monotonically increasing counter.
  useSyncExternalStore(
    Store.subscribe,
    () => version,
    () => version,
  );
  return selector(state);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    Store.subscribe,
    () => hydrated,
    () => hydrated,
  );
}

export function useHydrate() {
  useEffect(() => {
    if (!hydrated) hydrate();
  }, []);
}
