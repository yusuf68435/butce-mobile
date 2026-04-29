import { csvFilename, transactionsToCsv } from "../csv";
import { Transaction } from "../../store/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? "x",
    type: p.type ?? "expense",
    category: p.category ?? "Market",
    amount: p.amount ?? 100,
    date: p.date ?? "2026-04-15",
    description: p.description,
    tags: p.tags,
  };
}

describe("transactionsToCsv", () => {
  test("includes RFC 4180 header row", () => {
    const csv = transactionsToCsv([]);
    expect(csv.split("\r\n")[0]).toBe(
      "id,date,type,category,amount,description,tags",
    );
  });

  test("expense amount is negated, income stays positive", () => {
    const csv = transactionsToCsv([
      tx({ id: "a", type: "expense", amount: 250 }),
      tx({ id: "b", type: "income", amount: 5000, date: "2026-04-16" }),
    ]);
    const lines = csv.trim().split("\r\n");
    const aRow = lines.find((l) => l.startsWith("a,"))!;
    const bRow = lines.find((l) => l.startsWith("b,"))!;
    expect(aRow).toContain(",-250,");
    expect(bRow).toContain(",5000,");
  });

  test("escapes fields with commas/quotes/newlines", () => {
    const csv = transactionsToCsv([
      tx({
        id: "x",
        description: 'has, comma and "quote"\nand newline',
      }),
    ]);
    expect(csv).toContain('"has, comma and ""quote""\nand newline"');
  });

  test("tags joined with pipe", () => {
    const csv = transactionsToCsv([tx({ id: "x", tags: ["iş", "yemek"] })]);
    expect(csv).toContain("iş|yemek");
  });

  test("rows sorted newest first", () => {
    const csv = transactionsToCsv([
      tx({ id: "old", date: "2026-01-01" }),
      tx({ id: "new", date: "2026-04-01" }),
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toMatch(/^new,/);
    expect(lines[2]).toMatch(/^old,/);
  });

  test("CRLF line endings + trailing newline", () => {
    const csv = transactionsToCsv([tx({ id: "x" })]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain("\r\n");
  });
});

describe("csvFilename", () => {
  test("uses today's ISO date in filename", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(csvFilename()).toBe(`butce-hareketler-${today}.csv`);
  });

  test("custom prefix", () => {
    expect(csvFilename("test")).toContain("test-hareketler-");
  });
});
