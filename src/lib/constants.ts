import { RowColor } from "../theme/tokens";

export const STORAGE_KEY = "ggai:state:v1";
export const STATE_VERSION = 4;
export const AGED_DAYS = 60;
export const PRICE_ENDPOINT = "https://finans.truncgil.com/today.json";

export const DEFAULT_CATEGORIES = {
  income: ["Maaş/Proje", "Kira (gelen)"],
  expense: ["Kira/Ev", "Market", "Yakıt/Ulaşım", "Fatura", "Yemek", "Sağlık"],
};

export type IconName =
  | "gear"
  | "plus"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "cash"
  | "hourglass"
  | "diamond"
  | "arrow-down"
  | "arrow-up"
  | "trash"
  | "briefcase"
  | "house"
  | "sparkles"
  | "cart"
  | "fuel"
  | "doc"
  | "fork"
  | "building"
  | "heart"
  | "dot"
  | "wallet"
  | "x"
  | "check"
  | "search"
  | "bell"
  | "calendar"
  | "tag"
  | "chart"
  | "refresh";

export interface CategoryMeta {
  icon: IconName;
  color: RowColor;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "Maaş/Proje": { icon: "briefcase", color: "green" },
  "Kira (gelen)": { icon: "house", color: "green" },
  "Diğer gelir": { icon: "sparkles", color: "green" },
  "Kira/Ev": { icon: "house", color: "indigo" },
  Market: { icon: "cart", color: "orange" },
  "Yakıt/Ulaşım": { icon: "fuel", color: "blue" },
  Fatura: { icon: "doc", color: "purple" },
  Yemek: { icon: "fork", color: "pink" },
  "Ofis/UYART": { icon: "building", color: "gray" },
  Sağlık: { icon: "heart", color: "red" },
  "Diğer gider": { icon: "dot", color: "gray" },
};

export function categoryMeta(name: string): CategoryMeta {
  return CATEGORY_META[name] || { icon: "dot", color: "gray" };
}

export const ETA_OPTIONS: Array<{ key: PendingEta; label: string }> = [
  { key: "unknown", label: "Belirsiz" },
  { key: "thisWeek", label: "Bu hafta" },
  { key: "thisMonth", label: "Bu ay" },
  { key: "1to3m", label: "1-3 ay" },
  { key: "3mPlus", label: "3 ay+" },
];

export type PendingEta =
  | "unknown"
  | "thisWeek"
  | "thisMonth"
  | "1to3m"
  | "3mPlus";

export const ETA_LABELS: Record<PendingEta, string> = Object.fromEntries(
  ETA_OPTIONS.map((o) => [o.key, o.label]),
) as Record<PendingEta, string>;
