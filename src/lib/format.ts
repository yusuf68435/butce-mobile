export const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
export const TR_MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

export function fmtTRY(n: number): string {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}₺${Math.abs(v).toLocaleString("tr-TR")}`;
}

/**
 * Replace digits/separators in a money-ish string with bullets while keeping
 * sign and currency symbols visible. Used by privacy mode (Settings → Bakiyeyi
 * Gizle) so the layout/colors don't shift when masking is on.
 */
export function maskMoney(text: string, hide: boolean | undefined): string {
  if (!hide) return text;
  return text.replace(/[\d.,]/g, "•");
}

export function fmtSigned(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return fmtTRY(0);
  return (v > 0 ? "+" : "−") + fmtTRY(Math.abs(v)).replace("-", "");
}

export function fmtNum(n: number, opts: Intl.NumberFormatOptions = {}): string {
  return Number(n || 0).toLocaleString("tr-TR", opts);
}

export function fmtPct(v: number, digits = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${TR_MONTHS[m - 1]} ${y}`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Shift a YYYY-MM key by `delta` months. Wraps year boundaries. */
export function shiftMonthKey(key: string, delta: number): string {
  const [yStr, mStr] = key.split("-");
  let y = Number(yStr);
  let m = Number(mStr) + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function prevMonthKey(key: string): string {
  return shiftMonthKey(key, -1);
}

export function nextMonthKey(key: string): string {
  return shiftMonthKey(key, 1);
}

export type AmountQuery =
  | { kind: "range"; min: number; max: number }
  | { kind: "gt"; value: number }
  | { kind: "lt"; value: number }
  | null;

/**
 * Parse a search query as an amount filter.
 *   "200"           → null (text search; caller may still match by amount)
 *   "200-500"       → { kind: "range", min: 200, max: 500 }
 *   ">100" / "> 100"→ { kind: "gt", value: 100 }
 *   "<50"           → { kind: "lt", value: 50 }
 *   "1.234,56"      → null (TR-formatted text; not numeric query)
 * Whitespace tolerated. TR comma decimals tolerated inside numeric tokens.
 */
export function parseAmountQuery(input: string): AmountQuery {
  const q = input.trim();
  if (!q) return null;
  const range = q.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/);
  if (range) {
    const min = parseFloat(range[1].replace(",", "."));
    const max = parseFloat(range[2].replace(",", "."));
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { kind: "range", min, max };
  }
  const cmp = q.match(/^([<>])\s*(\d+(?:[.,]\d+)?)$/);
  if (cmp) {
    const value = parseFloat(cmp[2].replace(",", "."));
    if (!Number.isFinite(value)) return null;
    return { kind: cmp[1] === ">" ? "gt" : "lt", value };
  }
  return null;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input !== "string") input = String(input ?? "");
  const cleaned = input
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function inputAmount(n: number | null | undefined): string {
  return n ? String(n).replace(".", ",") : "";
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Normalize a list of tags: trim, drop empties, dedup case-insensitively.
 * Preserves the casing of the first occurrence.
 */
export function normalizeTags(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : input.split(",").map((s) => s);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
