import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "ggai:prices:v1";
const TTL_MS = 15 * 60 * 1000;

export interface Prices {
  gold: number;
  usd: number;
  eur: number;
  silver: number;
  updatedAt: string;
}

interface Cached {
  prices: Prices;
  fetchedAt: number;
}

let memo: Cached | null = null;

export function parseTRNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const cleaned = v
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function pickPrice(obj: unknown, keys: string[]): number {
  if (!obj || typeof obj !== "object") return 0;
  const root = obj as Record<string, unknown>;
  for (const k of keys) {
    const node = root[k];
    if (!node) continue;
    let raw: unknown;
    if (typeof node === "object") {
      const o = node as Record<string, unknown>;
      raw = o.Selling ?? o.selling ?? o.Buying ?? o.buying ?? node;
    } else {
      raw = node;
    }
    const n = parseTRNumber(raw);
    if (n > 0) return n;
  }
  return 0;
}

async function fetchFromTruncgil(): Promise<Prices | null> {
  try {
    const res = await fetch("https://finans.truncgil.com/today.json");
    if (!res.ok) return null;
    const data = await res.json();
    const gold = pickPrice(data, ["gram-altin", "gram_altin", "GRA"]);
    const usd = pickPrice(data, ["USD"]);
    const eur = pickPrice(data, ["EUR"]);
    const silver = pickPrice(data, ["gumus", "GUMUSTRY", "XAG"]);
    if (gold <= 0 && usd <= 0) return null;
    return {
      gold,
      usd,
      eur,
      silver,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFromTCMB(prev: Partial<Prices>): Promise<Prices | null> {
  try {
    const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml");
    if (!res.ok) return null;
    const xml = await res.text();
    const usd = pickTcmbRate(xml, "USD");
    const eur = pickTcmbRate(xml, "EUR");
    if (usd <= 0) return null;
    return {
      gold: prev.gold ?? 0,
      usd,
      eur,
      silver: prev.silver ?? 0,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function pickTcmbRate(xml: string, code: string): number {
  const blockRe = new RegExp(
    `<Currency[^>]*Kod="${code}"[^>]*>([\\s\\S]*?)</Currency>`,
    "i",
  );
  const block = xml.match(blockRe)?.[1];
  if (!block) return 0;
  const sellMatch = block.match(/<ForexSelling>([^<]+)<\/ForexSelling>/i);
  const banknoteMatch = block.match(
    /<BanknoteSelling>([^<]+)<\/BanknoteSelling>/i,
  );
  const raw = sellMatch?.[1] || banknoteMatch?.[1] || "";
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

async function fetchFromExchangerate(
  prev: Partial<Prices>,
): Promise<Prices | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const data = await res.json();
    const rates = data?.rates;
    if (!rates) return null;
    const usdTry = parseTRNumber(rates.TRY);
    const eurUsd = parseTRNumber(rates.EUR);
    if (usdTry <= 0) return null;
    return {
      gold: prev.gold ?? 0,
      usd: usdTry,
      eur: eurUsd > 0 ? usdTry / eurUsd : 0,
      silver: prev.silver ?? 0,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCachedPrices(): Promise<Prices | null> {
  if (memo) return memo.prices;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: Cached = JSON.parse(raw);
    memo = parsed;
    return parsed.prices;
  } catch {
    return null;
  }
}

export async function fetchPrices(force = false): Promise<Prices | null> {
  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed: Cached = JSON.parse(raw);
        if (Date.now() - parsed.fetchedAt < TTL_MS) {
          memo = parsed;
          return parsed.prices;
        }
      }
    } catch {}
  }

  let prices = await fetchFromTruncgil();
  if (!prices || prices.usd <= 0) {
    const tcmb = await fetchFromTCMB(prices ?? {});
    if (tcmb) {
      prices = {
        ...tcmb,
        gold: prices?.gold ?? tcmb.gold,
        silver: prices?.silver ?? tcmb.silver,
      };
    }
  }
  if (!prices || prices.usd <= 0) {
    const fallback = await fetchFromExchangerate(prices ?? {});
    if (fallback) {
      prices = {
        ...fallback,
        gold: prices?.gold ?? fallback.gold,
        silver: prices?.silver ?? fallback.silver,
      };
    }
  }
  if (!prices) return null;

  const cached: Cached = { prices, fetchedAt: Date.now() };
  memo = cached;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {}
  return prices;
}

export function priceForKind(
  p: Prices,
  kind: "gold" | "silver" | "usd" | "eur",
): number {
  if (kind === "gold") return p.gold;
  if (kind === "silver") return p.silver;
  if (kind === "usd") return p.usd;
  if (kind === "eur") return p.eur;
  return 0;
}

export async function fetchStockPrice(symbol: string): Promise<number | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  const yfSymbol = sym.includes(".") ? sym : `${sym}.IS`;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? meta?.previousClose;
    const n = typeof price === "number" ? price : parseTRNumber(price);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}
