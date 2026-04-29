import { monthKeyOf, todayISO, uid } from "../lib/format";
import { AppState, Period, Recurring, Transaction } from "./types";

export type WithTransactions = { transactions: Transaction[] };

export function txOfMonth(s: WithTransactions, key: string): Transaction[] {
  return s.transactions.filter((t) => monthKeyOf(t.date) === key);
}

/** Last 7 calendar days (incl. today). Pure ISO arithmetic, TZ-safe enough. */
export function txOfLastDays(
  s: WithTransactions,
  days: number,
  ref: Date = new Date(),
): Transaction[] {
  const since = new Date(
    Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate() - (days - 1)),
  )
    .toISOString()
    .slice(0, 10);
  return s.transactions.filter((t) => t.date >= since);
}

export function weeklyTotals(s: WithTransactions): {
  income: number;
  expense: number;
  net: number;
} {
  const list = txOfLastDays(s, 7);
  const income = list
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const expense = list
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  return { income, expense, net: income - expense };
}

export function totalsOf(s: AppState, key: string) {
  const list = txOfMonth(s, key);
  const income = list
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const expense = list
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  return { income, expense, balance: income - expense, list };
}

export interface CategorySpend {
  category: string;
  spent: number;
  limit: number;
  pct: number;
  remaining: number;
}

export function categorySpendOfMonth(
  s: AppState,
  key: string,
): CategorySpend[] {
  const list = txOfMonth(s, key).filter((t) => t.type === "expense");
  const map = new Map<string, number>();
  for (const t of list)
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  const limits = s.settings.budgetLimits || [];
  const seen = new Set<string>();
  const rows: CategorySpend[] = [];
  for (const l of limits) {
    seen.add(l.category);
    const spent = map.get(l.category) || 0;
    rows.push({
      category: l.category,
      spent,
      limit: l.amount,
      pct: l.amount > 0 ? (spent / l.amount) * 100 : 0,
      remaining: l.amount - spent,
    });
  }
  return rows;
}

export function addPeriod(iso: string, period: Period): string {
  // ISO "YYYY-MM-DD" → UTC anchored, immune to local TZ.
  const [yStr, mStr, dStr] = iso.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const day = Number(dStr);
  let d: Date;
  if (period === "weekly") {
    d = new Date(Date.UTC(y, m - 1, day));
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (period === "yearly") {
    d = new Date(Date.UTC(y + 1, m - 1, day));
  } else {
    // monthly — JS rolls Feb 31 → Mar 3, which we keep (matches existing test expectation).
    d = new Date(Date.UTC(y, m, day));
  }
  return d.toISOString().slice(0, 10);
}

export function nextDueOf(r: Recurring): string {
  const last = r.lastChargedDate;
  if (!last) return r.startDate;
  return addPeriod(last, r.period);
}

export function dueRecurring(s: AppState, today = todayISO()): Recurring[] {
  return (s.recurring || []).filter((r) => r.active && nextDueOf(r) <= today);
}

/** Active recurring whose nextDue is between [today, today + days]. */
export function upcomingRecurring(
  s: AppState,
  days = 7,
  today = todayISO(),
): { recurring: Recurring; due: string }[] {
  const horizon = addDays(today, days);
  const out: { recurring: Recurring; due: string }[] = [];
  for (const r of s.recurring || []) {
    if (!r.active) continue;
    const due = nextDueOf(r);
    if (due >= today && due <= horizon) out.push({ recurring: r, due });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export interface ChargeResult {
  txCreated: number;
  recurringIds: string[];
}

/**
 * Cap on how many missed periods we'll retroactively charge.
 * Protects against:
 *   - User adds a recurring with `startDate` years in the past → flooding tx list
 *   - User reopens app after months idle → noisy backlog
 *
 * If lastCharged is >12 months stale, we silently advance lastCharged
 * to ~12 months ago and only generate that many charges.
 */
const MAX_BACKLOG_PERIODS = 24;

export function chargeDueRecurring(
  s: AppState,
  today = todayISO(),
): ChargeResult {
  const result: ChargeResult = { txCreated: 0, recurringIds: [] };
  const list = s.recurring || [];
  for (const r of list) {
    if (!r.active) continue;
    let due = nextDueOf(r);
    let charged = false;
    let safety = 0;
    while (due <= today && safety < MAX_BACKLOG_PERIODS) {
      s.transactions.push({
        id: uid(),
        type: r.type,
        category: r.category,
        description: r.name,
        amount: r.amount,
        date: due,
      });
      r.lastChargedDate = due;
      due = addPeriod(due, r.period);
      result.txCreated += 1;
      charged = true;
      safety += 1;
    }
    // If we hit the cap and there's still backlog, fast-forward
    // lastChargedDate to today so the next call doesn't re-trigger.
    if (safety >= MAX_BACKLOG_PERIODS && due <= today) {
      r.lastChargedDate = today;
    }
    if (charged) result.recurringIds.push(r.id);
  }
  return result;
}

export interface MonthlyTotal {
  key: string;
  income: number;
  expense: number;
  net: number;
}

export function monthlyTotals(
  s: WithTransactions,
  count = 12,
  refKey?: string,
): MonthlyTotal[] {
  const ref =
    refKey ||
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
  const [yStr, mStr] = ref.split("-");
  let y = Number(yStr);
  let m = Number(mStr);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return keys.map((k) => {
    const list = txOfMonth(s, k);
    const income = list
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + t.amount, 0);
    const expense = list
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + t.amount, 0);
    return { key: k, income, expense, net: income - expense };
  });
}

export interface YearlySummary {
  year: number;
  income: number;
  expense: number;
  net: number;
  topCategories: { category: string; amount: number }[];
}

export interface MerchantSpend {
  merchant: string;
  amount: number;
  count: number;
}

/** Pull repeating tokens from `description` and rank by total expense. */
export function merchantSpending(
  s: WithTransactions,
  monthKey?: string,
  limit = 5,
): MerchantSpend[] {
  const counts = new Map<string, { amount: number; count: number }>();
  for (const t of s.transactions) {
    if (t.type !== "expense") continue;
    if (monthKey && monthKeyOf(t.date) !== monthKey) continue;
    const desc = (t.description ?? "").trim();
    if (!desc) continue;
    // Take the first capitalized word ≥3 chars as merchant signal.
    // ("Migros alışveriş" → "Migros", "Şok Market" → "Şok")
    const tokens = desc.split(/\s+/);
    const merchant =
      tokens.find((w) => w.length >= 3 && /^[A-ZĞÜŞİÖÇ]/.test(w)) ?? tokens[0];
    if (!merchant || merchant.length < 2) continue;
    const cur = counts.get(merchant) || { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    counts.set(merchant, cur);
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= 2) // tek seferlik şeyler merchant değil
    .map(([merchant, v]) => ({ merchant, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface TagSpend {
  tag: string;
  amount: number;
  count: number;
}

export function tagSpending(
  s: WithTransactions,
  monthKey?: string,
): TagSpend[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of s.transactions) {
    if (t.type !== "expense") continue;
    if (monthKey && monthKeyOf(t.date) !== monthKey) continue;
    for (const tag of t.tags || []) {
      const cur = map.get(tag) || { amount: 0, count: 0 };
      cur.amount += t.amount;
      cur.count += 1;
      map.set(tag, cur);
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => ({ tag, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);
}

export function yearlySummary(
  s: WithTransactions,
  year: number,
): YearlySummary {
  const list = s.transactions.filter((t) => t.date.startsWith(`${year}-`));
  const income = list
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + t.amount, 0);
  const expense = list
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const byCat = new Map<string, number>();
  for (const t of list.filter((x) => x.type === "expense"))
    byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }));
  return { year, income, expense, net: income - expense, topCategories };
}

export function assetValue(a: {
  amount: number;
  buyPrice: number;
  currentPrice?: number | null;
}): number {
  const unit =
    a.currentPrice && a.currentPrice > 0 ? a.currentPrice : a.buyPrice;
  return a.amount * unit;
}

export function assetsTotal(s: AppState): number {
  return (s.assets || []).reduce((a, p) => a + assetValue(p), 0);
}

export function debtsNet(s: AppState): number {
  // Positive = others owe me; Negative = I owe
  return (s.debts || [])
    .filter((d) => !d.paid)
    .reduce((a, d) => a + (d.kind === "lent" ? d.amount : -d.amount), 0);
}

export function wealthBreakdown(s: AppState) {
  const cash = s.transactions.reduce(
    (a, t) => a + (t.type === "income" ? t.amount : -t.amount),
    0,
  );
  const pending = s.pending.reduce((a, p) => a + p.amount, 0);
  const assets = assetsTotal(s);
  const debts = debtsNet(s);
  return {
    cash,
    pending,
    assets,
    debts,
    total: cash + pending + assets + debts,
  };
}
