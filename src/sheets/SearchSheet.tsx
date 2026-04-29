import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented, Chip, ChipGrid, FieldLabel } from "../ui/Controls";
import { TextField } from "../ui/TextField";
import { useStore } from "../store/store";
import { TxType } from "../store/types";
import { categoryMeta } from "../lib/constants";
import { fmtDate, fmtTRY, parseAmountQuery } from "../lib/format";
import { TxSheetRef } from "./TxSheet";

export interface SearchSheetRef {
  open: () => void;
}

type Filter = "all" | TxType;

interface Props {
  txSheet: React.RefObject<TxSheetRef | null>;
}

const HISTORY_KEY = "ggai:search:history:v1";
const HISTORY_MAX = 5;

export const SearchSheet = forwardRef<SearchSheetRef, Props>(
  function SearchSheet({ txSheet }, ref) {
    const sheet = useRef<SheetRef>(null);
    const transactions = useStore((s) => s.transactions);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [cat, setCat] = useState<string | null>(null);
    const [tag, setTag] = useState<string | null>(null);
    const [range, setRange] = useState<"all" | "30d" | "90d" | "ytd">("all");
    const [sort, setSort] = useState<"date" | "amount">("date");
    const [history, setHistory] = useState<string[]>([]);
    const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      AsyncStorage.getItem(HISTORY_KEY)
        .then((raw) => {
          if (!raw) return;
          const arr = JSON.parse(raw);
          if (Array.isArray(arr))
            setHistory(arr.filter((x) => typeof x === "string"));
        })
        .catch(() => {});
    }, []);

    function commitHistory(q: string) {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      setHistory((prev) => {
        const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(
          0,
          HISTORY_MAX,
        );
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }

    function clearHistory() {
      setHistory([]);
      AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
    }

    function changeQuery(v: string) {
      setQuery(v);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => commitHistory(v), 1500);
    }

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setQuery("");
          setFilter("all");
          setCat(null);
          setTag(null);
          setRange("all");
          setSort("date");
          sheet.current?.open();
        },
      }),
      [],
    );

    const allCats = useMemo(() => {
      const set = new Set<string>();
      for (const tx of transactions) set.add(tx.category);
      return [...set].sort();
    }, [transactions]);

    const allTags = useMemo(() => {
      const set = new Set<string>();
      for (const tx of transactions)
        for (const tag of tx.tags || []) set.add(tag);
      return [...set].sort();
    }, [transactions]);

    const minDate = useMemo(() => {
      if (range === "all") return null;
      const d = new Date();
      if (range === "30d") d.setDate(d.getDate() - 30);
      else if (range === "90d") d.setDate(d.getDate() - 90);
      else if (range === "ytd") d.setMonth(0, 1);
      return d.toISOString().slice(0, 10);
    }, [range]);

    // "200" plain text → null (text search). "200-500" / ">100" / "<50" → typed.
    const numericFilter = useMemo(() => parseAmountQuery(query), [query]);

    const results = useMemo(() => {
      const q = query.trim().toLowerCase();
      return transactions
        .filter((tx) => {
          if (filter !== "all" && tx.type !== filter) return false;
          if (cat && tx.category !== cat) return false;
          if (tag && !(tx.tags || []).includes(tag)) return false;
          if (minDate && tx.date < minDate) return false;
          if (!q) return true;
          // Numeric query takes precedence over text search.
          if (numericFilter) {
            if (numericFilter.kind === "range") {
              return (
                tx.amount >= numericFilter.min && tx.amount <= numericFilter.max
              );
            }
            if (numericFilter.kind === "gt")
              return tx.amount > numericFilter.value;
            if (numericFilter.kind === "lt")
              return tx.amount < numericFilter.value;
          }
          // Amount included in haystack so plain "200" finds 200 ₺ tx.
          const hay =
            `${tx.category} ${tx.description ?? ""} ${tx.date} ${tx.amount} ${(tx.tags || []).join(" ")}`.toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => {
          if (sort === "amount") {
            return b.amount - a.amount;
          }
          return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
        });
    }, [transactions, query, filter, cat, tag, minDate, numericFilter, sort]);

    const total = useMemo(
      () =>
        results.reduce(
          (a, t) => a + (t.type === "income" ? t.amount : -t.amount),
          0,
        ),
      [results],
    );

    return (
      <Sheet ref={sheet} title="Ara" cancelLabel="Kapat">
        <View>
          <TextField
            inSheet
            value={query}
            onChangeText={changeQuery}
            placeholder="Kategori, açıklama, tarih…"
            autoCapitalize="none"
          />
        </View>

        {!query && history.length > 0 && (
          <View>
            <FieldLabel>Son aramalar</FieldLabel>
            <ChipGrid>
              {history.map((h) => (
                <Chip key={h} label={h} onPress={() => setQuery(h)} />
              ))}
              <Chip label="Temizle" onPress={clearHistory} />
            </ChipGrid>
          </View>
        )}

        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "Hepsi" },
            { key: "expense", label: "Gider" },
            { key: "income", label: "Gelir" },
          ]}
        />

        <Segmented<"all" | "30d" | "90d" | "ytd">
          value={range}
          onChange={setRange}
          options={[
            { key: "all", label: "Tümü" },
            { key: "30d", label: "30 gün" },
            { key: "90d", label: "90 gün" },
            { key: "ytd", label: "Yıl" },
          ]}
        />

        <Segmented<"date" | "amount">
          value={sort}
          onChange={setSort}
          options={[
            { key: "date", label: "Tarih" },
            { key: "amount", label: "Tutar" },
          ]}
        />

        {allCats.length > 0 && (
          <View>
            <FieldLabel>Kategori</FieldLabel>
            <ChipGrid>
              <Chip
                label="Tümü"
                active={cat === null}
                onPress={() => setCat(null)}
              />
              {allCats.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={c === cat}
                  onPress={() => setCat(c === cat ? null : c)}
                />
              ))}
            </ChipGrid>
          </View>
        )}

        {allTags.length > 0 && (
          <View>
            <FieldLabel>Etiket</FieldLabel>
            <ChipGrid>
              <Chip
                label="Tümü"
                active={tag === null}
                onPress={() => setTag(null)}
              />
              {allTags.map((tg) => (
                <Chip
                  key={tg}
                  label={tg}
                  active={tg === tag}
                  onPress={() => setTag(tg === tag ? null : tg)}
                />
              ))}
            </ChipGrid>
          </View>
        )}

        <Grouped
          header={`${results.length} sonuç`}
          footer={`Net: ${fmtTRY(total)}`}
        >
          {results.length === 0 ? (
            <RowEmpty>Sonuç yok.</RowEmpty>
          ) : (
            results.slice(0, 200).map((tx, i) => {
              const meta = categoryMeta(tx.category);
              const sign = tx.type === "income" ? "+" : "−";
              const sub = tx.description
                ? `${tx.description} · ${fmtDate(tx.date)}`
                : fmtDate(tx.date);
              return (
                <Row
                  key={tx.id}
                  icon={meta.icon}
                  iconColor={meta.color}
                  title={tx.category}
                  sub={sub}
                  value={`${sign}${fmtTRY(tx.amount).replace("-", "")}`}
                  valueTone={tx.type === "income" ? "pos" : "default"}
                  onPress={() => {
                    sheet.current?.close();
                    setTimeout(() => txSheet.current?.open(tx.id), 250);
                  }}
                  isFirst={i === 0}
                />
              );
            })
          )}
        </Grouped>
      </Sheet>
    );
  },
);
