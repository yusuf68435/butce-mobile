import {
  addPeriod,
  assetValue,
  assetsTotal,
  chargeDueRecurring,
  debtsNet,
  merchantSpending,
  monthlyTotals,
  nextDueOf,
  tagSpending,
  totalsOf,
  txOfLastDays,
  upcomingRecurring,
  weeklyTotals,
  yearlySummary,
} from "../selectors";
import { AppState, Asset, Debt, Recurring, Transaction } from "../types";

function emptyState(): AppState {
  return {
    transactions: [],
    pending: [],
    recurring: [],
    goals: [],
    assets: [],
    debts: [],
    templates: [],
    categories: { income: [], expense: [] },
    settings: {},
  };
}

function tx(
  date: string,
  amount: number,
  type: "income" | "expense" = "expense",
  category = "Market",
  tags?: string[],
): Transaction {
  return {
    id: `${date}-${amount}-${(tags || []).join(",")}`,
    type,
    category,
    amount,
    date,
    tags,
  };
}

describe("addPeriod", () => {
  test("daily/weekly/monthly/yearly arithmetic", () => {
    expect(addPeriod("2026-04-01", "weekly")).toBe("2026-04-08");
    expect(addPeriod("2026-04-30", "monthly")).toBe("2026-05-30");
    expect(addPeriod("2026-12-31", "yearly")).toBe("2027-12-31");
  });

  test("month rollover", () => {
    expect(addPeriod("2026-01-31", "monthly")).toBe("2026-03-03");
  });
});

describe("nextDueOf", () => {
  test("uses lastChargedDate when present", () => {
    const r: Recurring = {
      id: "1",
      type: "expense",
      name: "Netflix",
      category: "Eğlence",
      amount: 100,
      period: "monthly",
      startDate: "2026-01-15",
      lastChargedDate: "2026-03-15",
      active: true,
    };
    expect(nextDueOf(r)).toBe("2026-04-15");
  });

  test("falls back to startDate when never charged", () => {
    const r: Recurring = {
      id: "1",
      type: "expense",
      name: "Netflix",
      category: "Eğlence",
      amount: 100,
      period: "monthly",
      startDate: "2026-04-15",
      active: true,
    };
    expect(nextDueOf(r)).toBe("2026-04-15");
  });
});

describe("totalsOf", () => {
  test("filters by month and computes balance", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-04-01", 1000, "income"),
      tx("2026-04-15", 250, "expense"),
      tx("2026-04-22", 100, "expense"),
      tx("2026-03-10", 500, "expense"), // başka ay
    ];
    const r = totalsOf(s, "2026-04");
    expect(r.income).toBe(1000);
    expect(r.expense).toBe(350);
    expect(r.balance).toBe(650);
    expect(r.list).toHaveLength(3);
  });

  test("empty month returns zeros", () => {
    const s = emptyState();
    const r = totalsOf(s, "2026-04");
    expect(r).toEqual({ income: 0, expense: 0, balance: 0, list: [] });
  });
});

describe("monthlyTotals", () => {
  test("returns N months ending at refKey", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-02-01", 100, "income"),
      tx("2026-03-01", 200, "expense"),
      tx("2026-04-01", 300, "income"),
    ];
    const r = monthlyTotals(s, 3, "2026-04");
    expect(r).toHaveLength(3);
    expect(r[0].key).toBe("2026-02");
    expect(r[2].key).toBe("2026-04");
    expect(r[2].income).toBe(300);
    expect(r[1].expense).toBe(200);
  });
});

describe("yearlySummary", () => {
  test("aggregates a year and ranks top categories", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-01-01", 1000, "income", "Maaş"),
      tx("2026-02-15", 400, "expense", "Market"),
      tx("2026-03-15", 200, "expense", "Market"),
      tx("2026-03-15", 350, "expense", "Kira/Ev"),
      tx("2025-12-31", 9999, "expense", "Eski yıl"),
    ];
    const r = yearlySummary(s, 2026);
    expect(r.income).toBe(1000);
    expect(r.expense).toBe(950);
    expect(r.net).toBe(50);
    expect(r.topCategories[0]).toEqual({ category: "Market", amount: 600 });
    expect(r.topCategories[1]).toEqual({ category: "Kira/Ev", amount: 350 });
  });
});

describe("chargeDueRecurring", () => {
  test("creates pending transactions up to today and updates lastChargedDate", () => {
    const s = emptyState();
    const r: Recurring = {
      id: "r1",
      type: "expense",
      name: "Netflix",
      category: "Eğlence",
      amount: 250,
      period: "monthly",
      startDate: "2026-01-15",
      active: true,
    };
    s.recurring = [r];
    const result = chargeDueRecurring(s, "2026-04-20");
    expect(result.txCreated).toBe(4); // Jan, Feb, Mar, Apr
    expect(result.recurringIds).toEqual(["r1"]);
    expect(s.transactions.map((t) => t.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
    expect(r.lastChargedDate).toBe("2026-04-15");
  });

  test("inactive recurring skipped", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "r1",
        type: "expense",
        name: "İptal",
        category: "X",
        amount: 1,
        period: "monthly",
        startDate: "2026-01-01",
        active: false,
      },
    ];
    expect(chargeDueRecurring(s, "2026-12-31").txCreated).toBe(0);
  });

  test("backlog capped at 24 periods, lastChargedDate fast-forwarded", () => {
    const s = emptyState();
    const r: Recurring = {
      id: "stale",
      type: "expense",
      name: "Old Sub",
      category: "X",
      amount: 50,
      period: "monthly",
      // 5 years ago — would be 60+ charges if uncapped
      startDate: "2021-01-15",
      active: true,
    };
    s.recurring = [r];
    const result = chargeDueRecurring(s, "2026-04-20");
    // Cap is 24, not 60+
    expect(result.txCreated).toBe(24);
    // After cap hit, lastChargedDate is fast-forwarded to today so the
    // next call doesn't continue charging.
    expect(r.lastChargedDate).toBe("2026-04-20");
    // Second call should be a no-op
    const second = chargeDueRecurring(s, "2026-04-20");
    expect(second.txCreated).toBe(0);
  });

  test("idempotent on second call", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "r1",
        type: "expense",
        name: "Netflix",
        category: "X",
        amount: 100,
        period: "monthly",
        startDate: "2026-04-01",
        active: true,
      },
    ];
    chargeDueRecurring(s, "2026-04-15");
    const after = chargeDueRecurring(s, "2026-04-15");
    expect(after.txCreated).toBe(0);
    expect(s.transactions).toHaveLength(1);
  });

  test("future startDate skipped today", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "r1",
        type: "expense",
        name: "Future bill",
        category: "X",
        amount: 200,
        period: "monthly",
        startDate: "2027-01-15",
        active: true,
      },
    ];
    const r = chargeDueRecurring(s, "2026-04-20");
    expect(r.txCreated).toBe(0);
    expect(s.transactions).toHaveLength(0);
  });

  test("re-enabling an inactive recurring picks up from lastCharged", () => {
    const s = emptyState();
    const r = {
      id: "r1",
      type: "expense" as const,
      name: "Spotify",
      category: "X",
      amount: 60,
      period: "monthly" as const,
      startDate: "2026-01-01",
      lastChargedDate: "2026-02-01",
      active: false,
    };
    s.recurring = [r];
    // Inactive — nothing should happen
    expect(chargeDueRecurring(s, "2026-04-20").txCreated).toBe(0);
    // User reactivates 2 months later
    r.active = true;
    const result = chargeDueRecurring(s, "2026-04-20");
    expect(result.txCreated).toBe(2); // March + April
    expect(s.transactions.map((t) => t.date)).toEqual([
      "2026-03-01",
      "2026-04-01",
    ]);
  });

  test("multi recurring sums into one result", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "a",
        type: "expense",
        name: "A",
        category: "X",
        amount: 1,
        period: "monthly",
        startDate: "2026-04-01",
        active: true,
      },
      {
        id: "b",
        type: "expense",
        name: "B",
        category: "Y",
        amount: 2,
        period: "monthly",
        startDate: "2026-04-10",
        active: true,
      },
    ];
    const r = chargeDueRecurring(s, "2026-04-20");
    expect(r.txCreated).toBe(2);
    expect(r.recurringIds.sort()).toEqual(["a", "b"]);
  });

  test("weekly period rolls across month boundary", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "w1",
        type: "expense",
        name: "Haftalık",
        category: "X",
        amount: 100,
        period: "weekly",
        startDate: "2026-03-25",
        active: true,
      },
    ];
    const r = chargeDueRecurring(s, "2026-04-15");
    // 03-25, 04-01, 04-08, 04-15 → 4 charges
    expect(r.txCreated).toBe(4);
    expect(s.transactions.map((t) => t.date)).toEqual([
      "2026-03-25",
      "2026-04-01",
      "2026-04-08",
      "2026-04-15",
    ]);
  });
});

describe("assetValue / assetsTotal", () => {
  test("uses currentPrice when set, falls back to buyPrice", () => {
    const a1: Asset = {
      id: "1",
      name: "Altın",
      kind: "gold",
      amount: 10,
      buyPrice: 4000,
      currentPrice: 4500,
    };
    const a2: Asset = {
      id: "2",
      name: "Dolar",
      kind: "usd",
      amount: 100,
      buyPrice: 35,
    };
    expect(assetValue(a1)).toBe(45000);
    expect(assetValue(a2)).toBe(3500);

    const s = emptyState();
    s.assets = [a1, a2];
    expect(assetsTotal(s)).toBe(48500);
  });
});

describe("debtsNet", () => {
  test("positive when receivables exceed payables; ignores paid", () => {
    const s = emptyState();
    const lent: Debt = {
      id: "1",
      name: "Ali",
      kind: "lent",
      amount: 500,
      createdAt: "2026-01-01",
    };
    const owe: Debt = {
      id: "2",
      name: "Ayşe",
      kind: "owe",
      amount: 200,
      createdAt: "2026-01-01",
    };
    const paid: Debt = {
      id: "3",
      name: "Veli",
      kind: "owe",
      amount: 9999,
      paid: true,
      createdAt: "2026-01-01",
    };
    s.debts = [lent, owe, paid];
    expect(debtsNet(s)).toBe(300);
  });
});

describe("upcomingRecurring", () => {
  test("returns active recurring within horizon, sorted asc", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "near",
        type: "expense",
        name: "Near",
        category: "X",
        amount: 100,
        period: "monthly",
        startDate: "2026-04-22",
        active: true,
      },
      {
        id: "far",
        type: "expense",
        name: "Far",
        category: "X",
        amount: 50,
        period: "monthly",
        startDate: "2026-05-30",
        active: true,
      },
      {
        id: "soon",
        type: "expense",
        name: "Soon",
        category: "X",
        amount: 25,
        period: "monthly",
        startDate: "2026-04-21",
        active: true,
      },
    ];
    const r = upcomingRecurring(s, 7, "2026-04-20");
    expect(r.map((u) => u.recurring.id)).toEqual(["soon", "near"]);
    expect(r[0].due).toBe("2026-04-21");
  });

  test("inactive skipped", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "off",
        type: "expense",
        name: "Off",
        category: "X",
        amount: 1,
        period: "monthly",
        startDate: "2026-04-22",
        active: false,
      },
    ];
    expect(upcomingRecurring(s, 7, "2026-04-20")).toEqual([]);
  });

  test("crosses month boundary correctly", () => {
    const s = emptyState();
    s.recurring = [
      {
        id: "r",
        type: "expense",
        name: "R",
        category: "X",
        amount: 100,
        period: "monthly",
        startDate: "2026-05-02",
        active: true,
      },
    ];
    const r = upcomingRecurring(s, 5, "2026-04-30");
    expect(r).toHaveLength(1);
    expect(r[0].due).toBe("2026-05-02");
  });
});

describe("tagSpending", () => {
  test("aggregates expenses by tag, sorted desc", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-04-01", 100, "expense", "Market", ["iş", "yemek"]),
      tx("2026-04-05", 200, "expense", "Yemek", ["iş"]),
      tx("2026-04-10", 50, "expense", "Yakıt", ["seyahat"]),
      tx("2026-04-15", 9999, "income", "Maaş", ["iş"]),
    ];
    const r = tagSpending(s);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ tag: "iş", amount: 300, count: 2 });
    expect(r[1]).toEqual({ tag: "yemek", amount: 100, count: 1 });
    expect(r[2]).toEqual({ tag: "seyahat", amount: 50, count: 1 });
  });

  test("filters by month when monthKey provided", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-04-01", 100, "expense", "Market", ["iş"]),
      tx("2026-03-01", 9999, "expense", "Market", ["iş"]),
    ];
    const r = tagSpending(s, "2026-04");
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(100);
  });

  test("returns empty when no tagged expenses", () => {
    const s = emptyState();
    s.transactions = [tx("2026-04-01", 100, "expense", "Market")];
    expect(tagSpending(s)).toEqual([]);
  });
});

describe("merchantSpending", () => {
  function txd(
    date: string,
    amount: number,
    description: string,
    category = "Market",
  ): Transaction {
    return {
      id: `${date}-${amount}-${description}`,
      type: "expense",
      category,
      amount,
      date,
      description,
    };
  }

  test("extracts capitalized first word as merchant, ranks by amount", () => {
    const s = emptyState();
    s.transactions = [
      txd("2026-04-01", 200, "Migros alışveriş"),
      txd("2026-04-05", 150, "Migros haftalık"),
      txd("2026-04-10", 80, "Şok market"),
      txd("2026-04-15", 60, "Şok ekstra"),
    ];
    const r = merchantSpending(s);
    expect(r[0].merchant).toBe("Migros");
    expect(r[0].amount).toBe(350);
    expect(r[0].count).toBe(2);
    expect(r[1].merchant).toBe("Şok");
    expect(r[1].amount).toBe(140);
  });

  test("requires at least 2 hits per merchant (skip one-offs)", () => {
    const s = emptyState();
    s.transactions = [
      txd("2026-04-01", 9999, "BirKezOlanYer"),
      txd("2026-04-02", 100, "Migros"),
      txd("2026-04-03", 100, "Migros"),
    ];
    const r = merchantSpending(s);
    expect(r.map((x) => x.merchant)).toEqual(["Migros"]);
  });

  test("filters by month when monthKey provided", () => {
    const s = emptyState();
    s.transactions = [
      txd("2026-04-01", 100, "Migros"),
      txd("2026-04-02", 100, "Migros"),
      txd("2026-03-01", 9999, "Migros"),
      txd("2026-03-02", 9999, "Migros"),
    ];
    const r = merchantSpending(s, "2026-04");
    expect(r[0].amount).toBe(200);
  });

  test("respects limit", () => {
    const s = emptyState();
    s.transactions = Array.from({ length: 8 }).flatMap((_, i) => [
      txd("2026-04-01", 100 + i, `Place${String.fromCharCode(65 + i)}`),
      txd("2026-04-02", 100 + i, `Place${String.fromCharCode(65 + i)}`),
    ]);
    const r = merchantSpending(s, undefined, 3);
    expect(r).toHaveLength(3);
  });

  test("skips transactions without description", () => {
    const s = emptyState();
    s.transactions = [
      txd("2026-04-01", 100, ""),
      txd("2026-04-02", 100, "  "),
      tx("2026-04-03", 100, "expense", "Market"), // no desc at all
    ];
    expect(merchantSpending(s)).toEqual([]);
  });
});

describe("txOfLastDays / weeklyTotals", () => {
  test("includes today and goes back N-1 days", () => {
    const s = emptyState();
    const today = new Date();
    const iso = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      return d.toISOString().slice(0, 10);
    };
    s.transactions = [
      tx(iso(0), 100, "income", "Maaş"),
      tx(iso(3), 50, "expense", "Market"),
      tx(iso(6), 30, "expense", "Yemek"),
      tx(iso(8), 9999, "expense", "Eski"),
    ];
    const list = txOfLastDays(s, 7, today);
    expect(list).toHaveLength(3);
    const wk = weeklyTotals(s);
    expect(wk.income).toBe(100);
    expect(wk.expense).toBe(80);
    expect(wk.net).toBe(20);
  });

  test("empty when no recent transactions", () => {
    const s = emptyState();
    s.transactions = [tx("2020-01-01", 100, "expense", "Market")];
    expect(weeklyTotals(s)).toEqual({ income: 0, expense: 0, net: 0 });
  });
});
