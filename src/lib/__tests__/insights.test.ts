import { anomalies, cashflowForecast, suggestCategory } from "../insights";
import { AppState, Transaction } from "../../store/types";

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
  type: Transaction["type"] = "expense",
  category = "Market",
  description?: string,
): Transaction {
  return {
    id: `${date}-${amount}-${category}`,
    type,
    category,
    amount,
    date,
    description,
  };
}

describe("suggestCategory", () => {
  test("returns most frequent category matching description substring", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-01-01", 50, "expense", "Market", "Migros alışveriş"),
      tx("2026-02-01", 60, "expense", "Market", "Migros haftalık"),
      tx("2026-03-01", 70, "expense", "Yemek", "Migros aslında"),
    ];
    expect(suggestCategory(s, "Migros", "expense")).toBe("Market");
  });

  test("returns null when description too short", () => {
    const s = emptyState();
    expect(suggestCategory(s, "ab", "expense")).toBeNull();
  });

  test("returns null on no match", () => {
    const s = emptyState();
    s.transactions = [tx("2026-01-01", 50, "expense", "Market", "Migros")];
    expect(suggestCategory(s, "Carrefour", "expense")).toBeNull();
  });

  test("filters by type — income search ignores expense matches", () => {
    const s = emptyState();
    s.transactions = [
      tx("2026-01-01", 50, "expense", "Market", "Şirket maaş ödemesi"),
    ];
    expect(suggestCategory(s, "maaş", "income")).toBeNull();
  });
});

describe("anomalies", () => {
  test("flags transactions ≥ 2.5x category median", () => {
    const today = new Date();
    const iso = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const s = emptyState();
    s.transactions = [
      tx(iso(80), 100, "expense", "Market"),
      tx(iso(60), 100, "expense", "Market"),
      tx(iso(40), 100, "expense", "Market"),
      tx(iso(20), 100, "expense", "Market"),
      tx(iso(5), 500, "expense", "Market"), // 5x median → anomaly
    ];
    const r = anomalies(s, 90);
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(500);
    expect(r[0].median).toBe(100);
  });

  test("ignores income type", () => {
    const today = new Date();
    const iso = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const s = emptyState();
    s.transactions = [
      tx(iso(40), 100, "income", "Maaş"),
      tx(iso(30), 100, "income", "Maaş"),
      tx(iso(5), 5000, "income", "Maaş"),
    ];
    expect(anomalies(s, 90)).toEqual([]);
  });

  test("requires minimum sample size in category", () => {
    const today = new Date();
    const iso = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const s = emptyState();
    s.transactions = [
      tx(iso(40), 100, "expense", "Market"),
      tx(iso(5), 500, "expense", "Market"), // not enough sample
    ];
    expect(anomalies(s, 90)).toEqual([]);
  });
});

describe("cashflowForecast", () => {
  test("projects 30-day balance from 3-month average", () => {
    const today = new Date();
    const isoMonth = (offsetMonths: number) => {
      const d = new Date(
        today.getFullYear(),
        today.getMonth() + offsetMonths,
        15,
      );
      return d.toISOString().slice(0, 10);
    };
    const s = emptyState();
    s.transactions = [
      tx(isoMonth(-2), 9000, "income", "Maaş"),
      tx(isoMonth(-2), 3000, "expense", "Market"),
      tx(isoMonth(-1), 9000, "income", "Maaş"),
      tx(isoMonth(-1), 3000, "expense", "Market"),
      tx(isoMonth(0), 9000, "income", "Maaş"),
      tx(isoMonth(0), 3000, "expense", "Market"),
    ];
    const r = cashflowForecast(s, 30);
    expect(r.inflowMonthly).toBe(9000);
    expect(r.outflowMonthly).toBe(3000);
    // current balance = 18000, +30d projection adds (9000-3000) = 6000
    expect(r.projected).toBeGreaterThan(20000);
  });

  test("zero history returns zero projection", () => {
    const r = cashflowForecast(emptyState(), 30);
    expect(r.inflowMonthly).toBe(0);
    expect(r.outflowMonthly).toBe(0);
    expect(r.projected).toBe(0);
  });
});
