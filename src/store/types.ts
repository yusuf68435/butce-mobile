import { PendingEta } from "../lib/constants";

export type TxType = "income" | "expense";
export type Period = "monthly" | "weekly" | "yearly";

export interface Transaction {
  id: string;
  type: TxType;
  category: string;
  description?: string;
  amount: number;
  date: string;
  tags?: string[];
  photoUri?: string | null;
}

export interface Pending {
  id: string;
  source: string;
  amount: number;
  eta: PendingEta;
  exactDate?: string | null;
  createdAt: string;
}

export interface Recurring {
  id: string;
  type: TxType;
  name: string;
  category: string;
  amount: number;
  period: Period;
  startDate: string;
  lastChargedDate?: string | null;
  active: boolean;
  notify?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline?: string | null;
  createdAt: string;
  /** When user has been congratulated for hitting target. Prevents repeats. */
  celebratedAt?: string;
}

export interface BudgetLimit {
  category: string;
  amount: number;
}

/** Asset varieties. Silver lives here too (formerly its own model). */
export type AssetKind = "gold" | "silver" | "usd" | "eur" | "other";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  amount: number;
  buyPrice: number;
  currentPrice?: number | null;
  buyDate?: string | null;
}

export type DebtKind = "owe" | "lent";

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  amount: number;
  dueDate?: string | null;
  note?: string;
  paid?: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  type: TxType;
  category: string;
  amount: number;
  description?: string;
  tags?: string[];
  emoji?: string;
}

export interface Settings {
  /** Legacy: gram silver price. Now stored on Asset.currentPrice directly. */
  silverGramPrice?: number | null;
  priceFetchedAt?: string;
  lastBackup?: string;
  lastUsedCategory?: { income?: string; expense?: string };
  budgetLimits?: BudgetLimit[];
  notifications?: boolean;
  notifyHour?: number;
  notifyMinute?: number;
  onboarded?: boolean;
  biometricLock?: boolean;
  /** Mask all currency amounts as `••••` until tapped (privacy mode) */
  hideBalance?: boolean;
}

export interface AppState {
  transactions: Transaction[];
  pending: Pending[];
  recurring: Recurring[];
  goals: Goal[];
  assets: Asset[];
  debts: Debt[];
  templates: Template[];
  categories: { income: string[]; expense: string[] };
  settings: Settings;
}
