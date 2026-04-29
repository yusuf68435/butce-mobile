import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { useTheme } from "../theme/tokens";
import { useStore } from "../store/store";
import { categoryMeta } from "../lib/constants";
import {
  currentMonthKey,
  fmtDate,
  fmtMonthLabel,
  fmtTRY,
  shiftMonthKey,
} from "../lib/format";
import { TxSheetRef } from "./TxSheet";

export interface CalendarSheetRef {
  open: () => void;
}

interface Props {
  txSheet: React.RefObject<TxSheetRef | null>;
}

const DOW = ["Pt", "Sa", "Çr", "Pe", "Cu", "Ct", "Pz"];

export const CalendarSheet = forwardRef<CalendarSheetRef, Props>(
  function CalendarSheet({ txSheet }, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const transactions = useStore((s) => s.transactions);
    const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
    const [selected, setSelected] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setMonthKey(currentMonthKey());
          setSelected(null);
          sheet.current?.open();
        },
      }),
      [],
    );

    const grid = useMemo(() => {
      const [y, m] = monthKey.split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0).getDate();
      const startDow = (first.getDay() + 6) % 7; // Mon=0
      const cells: Array<{ iso: string | null; day: number | null }> = [];
      for (let i = 0; i < startDow; i++) cells.push({ iso: null, day: null });
      for (let d = 1; d <= last; d++) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cells.push({ iso, day: d });
      }
      while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
      return cells;
    }, [monthKey]);

    const totalsByDay = useMemo(() => {
      const map = new Map<string, { income: number; expense: number }>();
      for (const tx of transactions) {
        if (!tx.date.startsWith(monthKey)) continue;
        const cur = map.get(tx.date) || { income: 0, expense: 0 };
        if (tx.type === "income") cur.income += tx.amount;
        else cur.expense += tx.amount;
        map.set(tx.date, cur);
      }
      return map;
    }, [transactions, monthKey]);

    // Compute the max single-day expense in this month for heatmap intensity scaling.
    const peakExpense = useMemo(() => {
      let peak = 0;
      for (const v of totalsByDay.values()) {
        if (v.expense > peak) peak = v.expense;
      }
      return peak;
    }, [totalsByDay]);

    const selectedTx = useMemo(() => {
      if (!selected) return [];
      return transactions
        .filter((tx) => tx.date === selected)
        .sort((a, b) => b.id.localeCompare(a.id));
    }, [transactions, selected]);

    function shift(delta: number) {
      setMonthKey(shiftMonthKey(monthKey, delta));
      setSelected(null);
    }

    return (
      <Sheet ref={sheet} title="Takvim" cancelLabel="Kapat">
        <View style={styles.header}>
          <Pressable onPress={() => shift(-1)} hitSlop={8}>
            <Text style={{ color: t.tint, fontSize: 22, paddingHorizontal: 8 }}>
              ‹
            </Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17,
              fontWeight: "600",
              color: t.label.primary,
            }}
          >
            {fmtMonthLabel(monthKey)}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={8}>
            <Text style={{ color: t.tint, fontSize: 22, paddingHorizontal: 8 }}>
              ›
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.grid,
            { backgroundColor: t.bg.elev, borderRadius: 12, padding: 8 },
          ]}
        >
          <View style={styles.row}>
            {DOW.map((d) => (
              <View key={d} style={styles.cell}>
                <Text
                  style={{
                    fontSize: 11,
                    color: t.label.tertiary,
                    textAlign: "center",
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>
          {Array.from({ length: grid.length / 7 }).map((_, row) => (
            <View key={row} style={styles.row}>
              {grid.slice(row * 7, row * 7 + 7).map((c, i) => {
                if (!c.iso) return <View key={i} style={styles.cell} />;
                const totals = totalsByDay.get(c.iso);
                const isSel = c.iso === selected;
                const net = totals ? totals.income - totals.expense : 0;
                // Heatmap intensity: 0.0 (no spend) → 1.0 (peak day this month).
                const intensity =
                  totals && peakExpense > 0
                    ? Math.min(1, totals.expense / peakExpense)
                    : 0;
                // Income-only days get a green tint instead of the heat ramp.
                const incomeOnly =
                  totals && totals.expense === 0 && totals.income > 0;
                // Dark mode needs higher floor for readable contrast against #000.
                const minAlpha = t.mode === "dark" ? 0.16 : 0.1;
                const maxAlpha = t.mode === "dark" ? 0.62 : 0.5;
                const cellBg = isSel
                  ? t.tint
                  : incomeOnly
                    ? hexAlpha(t.green, t.mode === "dark" ? 0.24 : 0.18)
                    : intensity > 0
                      ? hexAlpha(
                          t.red,
                          minAlpha + intensity * (maxAlpha - minAlpha),
                        )
                      : "transparent";
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelected(isSel ? null : c.iso)}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: cellBg,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSel ? "#fff" : t.label.primary,
                        textAlign: "center",
                        fontVariant: ["tabular-nums"],
                        fontWeight: intensity > 0.5 || isSel ? "600" : "400",
                      }}
                    >
                      {c.day}
                    </Text>
                    {totals && net !== 0 && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          marginTop: 2,
                          backgroundColor: isSel
                            ? "#fff"
                            : net > 0
                              ? t.green
                              : "transparent",
                        }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {selected && (
          <Grouped header={fmtDate(selected)}>
            {selectedTx.length === 0 ? (
              <RowEmpty>Bu günde hareket yok.</RowEmpty>
            ) : (
              selectedTx.map((tx, i) => {
                const meta = categoryMeta(tx.category);
                const sign = tx.type === "income" ? "+" : "−";
                return (
                  <Row
                    key={tx.id}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={tx.category}
                    sub={tx.description}
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
        )}
      </Sheet>
    );
  },
);

function hexAlpha(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  grid: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
