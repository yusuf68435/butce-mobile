import { AppState } from "../store/types";
import {
  monthlyTotals,
  nextDueOf,
  txOfMonth,
  wealthBreakdown,
} from "../store/selectors";
import { categoryMeta, IconName } from "./constants";
import { currentMonthKey, fmtTRY, prevMonthKey } from "./format";
import { RowColor } from "../theme/tokens";

export interface Insight {
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  iconColor: RowColor;
  tone: "pos" | "neg" | "info";
}

export function deriveInsights(s: AppState): Insight[] {
  const out: Insight[] = [];
  const now = currentMonthKey();
  const prev = prevMonthKey(now);

  const thisList = txOfMonth(s, now);
  const prevList = txOfMonth(s, prev);

  const thisExp = thisList
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  const prevExp = prevList
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);

  if (prevExp > 0) {
    const delta = ((thisExp - prevExp) / prevExp) * 100;
    if (Math.abs(delta) >= 10) {
      out.push({
        id: "monthly-delta",
        title:
          delta >= 0
            ? `Bu ay %${Math.round(delta)} daha çok harcadın`
            : `Bu ay %${Math.round(-delta)} daha az harcadın`,
        detail: `Geçen ay: ${fmtTRY(prevExp)} → Bu ay: ${fmtTRY(thisExp)}`,
        icon: delta >= 0 ? "arrow-up" : "arrow-down",
        iconColor: delta >= 0 ? "red" : "green",
        tone: delta >= 0 ? "neg" : "pos",
      });
    }
  }

  // Per-category change
  const thisByCat = new Map<string, number>();
  const prevByCat = new Map<string, number>();
  for (const t of thisList.filter((x) => x.type === "expense"))
    thisByCat.set(t.category, (thisByCat.get(t.category) || 0) + t.amount);
  for (const t of prevList.filter((x) => x.type === "expense"))
    prevByCat.set(t.category, (prevByCat.get(t.category) || 0) + t.amount);

  const catDeltas: { category: string; delta: number; cur: number }[] = [];
  for (const [cat, cur] of thisByCat) {
    const prv = prevByCat.get(cat) || 0;
    if (prv >= 200) {
      const d = ((cur - prv) / prv) * 100;
      if (Math.abs(d) >= 30) catDeltas.push({ category: cat, delta: d, cur });
    }
  }
  catDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const c of catDeltas.slice(0, 2)) {
    const meta = categoryMeta(c.category);
    out.push({
      id: `cat-${c.category}`,
      title: `${c.category} ${c.delta >= 0 ? "+" : ""}${Math.round(c.delta)}%`,
      detail: `Bu ay ${fmtTRY(c.cur)}`,
      icon: meta.icon,
      iconColor: meta.color,
      tone: c.delta >= 0 ? "neg" : "pos",
    });
  }

  // Budget warnings
  const limits = s.settings.budgetLimits || [];
  for (const l of limits) {
    const spent = thisByCat.get(l.category) || 0;
    if (l.amount > 0) {
      const pct = (spent / l.amount) * 100;
      if (pct >= 100) {
        out.push({
          id: `over-${l.category}`,
          title: `${l.category} bütçesi aşıldı`,
          detail: `${fmtTRY(spent)} / ${fmtTRY(l.amount)} (%${Math.round(pct)})`,
          icon: "x",
          iconColor: "red",
          tone: "neg",
        });
      } else if (pct >= 80) {
        out.push({
          id: `near-${l.category}`,
          title: `${l.category} sınırına yaklaşıyor`,
          detail: `${fmtTRY(spent)} / ${fmtTRY(l.amount)} (%${Math.round(pct)})`,
          icon: "bell",
          iconColor: "orange",
          tone: "neg",
        });
      }
    }
  }

  // Upcoming subscriptions in next 7 days
  const today = new Date();
  const horizon = new Date();
  horizon.setDate(today.getDate() + 7);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = (s.recurring || []).filter(
    (r) => r.active && nextDueOf(r) >= todayIso && nextDueOf(r) <= horizonIso,
  );
  if (upcoming.length > 0) {
    const sum = upcoming.reduce(
      (a, r) => a + (r.type === "expense" ? r.amount : -r.amount),
      0,
    );
    out.push({
      id: "upcoming",
      title: `${upcoming.length} abonelik 7 gün içinde`,
      detail: `Toplam çıkış: ${fmtTRY(sum)}`,
      icon: "calendar",
      iconColor: "indigo",
      tone: "info",
    });
  }

  // Year-over-year same-month delta
  const [yStr, mStr] = now.split("-").map(Number);
  const lastYearKey = `${yStr - 1}-${String(mStr).padStart(2, "0")}`;
  const lastYearList = txOfMonth(s, lastYearKey);
  const lastYearExp = lastYearList
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + t.amount, 0);
  if (lastYearExp >= 500) {
    const yoy = ((thisExp - lastYearExp) / lastYearExp) * 100;
    if (Math.abs(yoy) >= 15) {
      out.push({
        id: "yoy-delta",
        title:
          yoy >= 0
            ? `Geçen yıla göre %${Math.round(yoy)} daha çok`
            : `Geçen yıla göre %${Math.round(-yoy)} daha az`,
        detail: `${lastYearKey}: ${fmtTRY(lastYearExp)} → ${now}: ${fmtTRY(thisExp)}`,
        icon: yoy >= 0 ? "arrow-up" : "arrow-down",
        iconColor: yoy >= 0 ? "red" : "green",
        tone: yoy >= 0 ? "neg" : "pos",
      });
    }
  }

  // Backup reminder (14+ days)
  const lastBackup = s.settings?.lastBackup;
  if (s.transactions.length >= 5) {
    const ageDays = lastBackup
      ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
      : Infinity;
    if (ageDays >= 14) {
      out.push({
        id: "backup-stale",
        title: lastBackup
          ? `Yedeğin ${Math.min(ageDays, 999)} gün eski`
          : "Henüz yedek almadın",
        detail: "Ayarlar'dan tek dosyalık yedek paylaş.",
        icon: "arrow-down",
        iconColor: "orange",
        tone: "info",
      });
    }
  }

  // Overdue debts
  const overdue = (s.debts || []).filter(
    (d) => !d.paid && d.dueDate && d.dueDate < todayIso,
  );
  if (overdue.length > 0) {
    out.push({
      id: "overdue-debts",
      title: `${overdue.length} vadesi geçmiş borç/alacak`,
      detail: overdue.map((d) => d.name).join(", "),
      icon: "bell",
      iconColor: "red",
      tone: "neg",
    });
  }

  // Goal progress nudges
  for (const g of s.goals || []) {
    if (g.target <= 0) continue;
    const pct = (g.saved / g.target) * 100;
    if (g.deadline) {
      const days = Math.max(
        1,
        Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000),
      );
      const remaining = Math.max(0, g.target - g.saved);
      const monthlyNeed = (remaining / days) * 30;
      if (remaining > 0 && days > 0) {
        out.push({
          id: `goal-${g.id}`,
          title: `${g.name} için aylık ${fmtTRY(monthlyNeed)} biriktir`,
          detail: `${Math.round(pct)}% · ${days} gün kaldı`,
          icon: "sparkles",
          iconColor: "blue",
          tone: "info",
        });
      }
    } else if (pct >= 100) {
      out.push({
        id: `goal-${g.id}-done`,
        title: `${g.name} hedefine ulaştın 🎉`,
        detail: `${fmtTRY(g.saved)} / ${fmtTRY(g.target)}`,
        icon: "check",
        iconColor: "green",
        tone: "pos",
      });
    }
  }

  return out;
}

export interface CashflowForecast {
  days: number;
  inflowMonthly: number;
  outflowMonthly: number;
  recurringNet: number;
  projected: number;
}

export function cashflowForecast(s: AppState, days = 30): CashflowForecast {
  const months = monthlyTotals(s, 3);
  const avgIn =
    months.reduce((a, m) => a + m.income, 0) / Math.max(1, months.length);
  const avgOut =
    months.reduce((a, m) => a + m.expense, 0) / Math.max(1, months.length);
  const factor = days / 30;
  const recurringNet = (s.recurring || [])
    .filter((r) => r.active)
    .reduce((a, r) => {
      const monthly =
        r.period === "weekly"
          ? r.amount * (30 / 7)
          : r.period === "yearly"
            ? r.amount / 12
            : r.amount;
      return a + (r.type === "income" ? monthly : -monthly);
    }, 0);
  const wealth = wealthBreakdown(s);
  const projected = wealth.cash + (avgIn - avgOut) * factor;
  return {
    days,
    inflowMonthly: avgIn,
    outflowMonthly: avgOut,
    recurringNet,
    projected,
  };
}

export interface Anomaly {
  id: string;
  category: string;
  amount: number;
  median: number;
  date: string;
  description?: string;
}

export function anomalies(s: AppState, days = 90): Anomaly[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const recent = s.transactions.filter(
    (t) => t.type === "expense" && t.date >= cutoffIso,
  );
  const byCat = new Map<string, number[]>();
  for (const t of recent) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t.amount);
  }
  const medians = new Map<string, number>();
  for (const [cat, list] of byCat) {
    if (list.length < 4) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    medians.set(cat, median);
  }

  const out: Anomaly[] = [];
  for (const t of recent) {
    const med = medians.get(t.category);
    if (!med || med <= 0) continue;
    if (t.amount >= med * 2.5) {
      out.push({
        id: t.id,
        category: t.category,
        amount: t.amount,
        median: med,
        date: t.date,
        description: t.description,
      });
    }
  }
  return out
    .sort((a, b) => b.amount / b.median - a.amount / a.median)
    .slice(0, 5);
}

export function suggestCategory(
  s: AppState,
  description: string,
  type: "income" | "expense",
): string | null {
  const q = description.trim().toLowerCase();
  if (q.length < 3) return null;
  const candidates = s.transactions.filter(
    (t) =>
      t.type === type &&
      t.description &&
      t.description.toLowerCase().includes(q),
  );
  if (candidates.length === 0) return null;
  const tally = new Map<string, number>();
  for (const c of candidates)
    tally.set(c.category, (tally.get(c.category) || 0) + 1);
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}
