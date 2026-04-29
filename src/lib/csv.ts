// CSV export of transactions. RFC 4180 minimal: comma-separated, CRLF rows,
// double-quote escapes around fields containing comma/quote/newline.

import { Transaction } from "../store/types";

const HEADERS = [
  "id",
  "date",
  "type",
  "category",
  "amount",
  "description",
  "tags",
];

function escapeField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function transactionsToCsv(txs: Transaction[]): string {
  const rows: string[] = [HEADERS.join(",")];
  // Sort newest first for human readability when opened in Excel.
  const sorted = [...txs].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  for (const t of sorted) {
    rows.push(
      [
        t.id,
        t.date,
        t.type,
        t.category,
        // Always print absolute amount with sign by type for audits.
        t.type === "expense" ? -t.amount : t.amount,
        t.description ?? "",
        (t.tags || []).join("|"),
      ]
        .map(escapeField)
        .join(","),
    );
  }
  // CRLF + final newline → most Excel/LibreOffice variants happy.
  return rows.join("\r\n") + "\r\n";
}

/** Suggest a default file name. */
export function csvFilename(prefix = "butce"): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${prefix}-hareketler-${today}.csv`;
}
