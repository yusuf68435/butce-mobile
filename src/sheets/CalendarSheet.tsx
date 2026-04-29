import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sheet, SheetRef } from "../ui/Sheet";
import { Grouped } from "../ui/Grouped";
import { Row, RowEmpty } from "../ui/Row";
import { Segmented } from "../ui/Controls";
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
const TR_MON_SHORT = [
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

type ViewMode = "month" | "year";

// Local YYYY-MM-DD (matches what input pickers store; UTC-based toISOString
// is off-by-one east of UTC near midnight).
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const CalendarSheet = forwardRef<CalendarSheetRef, Props>(
  function CalendarSheet({ txSheet }, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const transactions = useStore((s) => s.transactions);
    const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
    const [selected, setSelected] = useState<string | null>(null);
    const [mode, setMode] = useState<ViewMode>("month");

    useImperativeHandle(
      ref,
      () => ({
        open() {
          setMonthKey(currentMonthKey());
          setSelected(null);
          setMode("month");
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

    // ── Annual heatmap (last 365 days, GitHub-style 53×7) ──────────────────
    const yearData = useMemo(() => {
      if (mode !== "year") return null;
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setDate(today.getDate() - 365);
      const cutoffIso = localISO(cutoff);
      const byDate: Record<string, number> = {};
      let total = 0;
      let days = 0;
      for (const tx of transactions) {
        if (tx.type !== "expense" || !tx.date) continue;
        if (tx.date < cutoffIso) continue;
        const prev = byDate[tx.date] || 0;
        if (prev === 0) days++;
        byDate[tx.date] = prev + tx.amount;
        total += tx.amount;
      }
      // Quartile thresholds for non-zero amounts
      const sorted = Object.values(byDate)
        .filter((v) => v > 0)
        .sort((a, b) => a - b);
      const q = (p: number) =>
        sorted[Math.max(0, Math.floor(sorted.length * p) - 1)] || 0;
      const q1 = q(0.25);
      const q2 = q(0.5);
      const q3 = q(0.75);
      const levelOf = (v: number) => {
        if (!v) return 0;
        if (v <= q1) return 1;
        if (v <= q2) return 2;
        if (v <= q3) return 3;
        return 4;
      };

      // Build grid: column = week, row = day. Start = Monday 52 weeks ago.
      const start = new Date(today);
      start.setDate(today.getDate() - 7 * 52);
      const dow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dow);
      const weeks = 53;
      const cells: Array<{
        iso: string | null;
        amt: number;
        level: number;
      }> = [];
      const monthLabels: Array<{ col: number; label: string }> = [];
      let lastMonth = -1;
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const dt = new Date(start);
          dt.setDate(start.getDate() + w * 7 + d);
          if (dt > today) {
            cells.push({ iso: null, amt: 0, level: 0 });
            continue;
          }
          const iso = localISO(dt);
          const amt = byDate[iso] || 0;
          cells.push({ iso, amt, level: levelOf(amt) });
        }
        const colStart = new Date(start);
        colStart.setDate(start.getDate() + w * 7);
        if (colStart <= today) {
          const m = colStart.getMonth();
          if (m !== lastMonth) {
            monthLabels.push({ col: w, label: TR_MON_SHORT[m] });
            lastMonth = m;
          }
        }
      }
      return { cells, weeks, monthLabels, total, days };
    }, [transactions, mode]);

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
        <View style={{ marginBottom: 12 }}>
          <Segmented
            options={[
              { key: "month", label: "Ay" },
              { key: "year", label: "Yıl" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setSelected(null);
            }}
          />
        </View>

        {mode === "month" && (
          <View style={styles.header}>
            <Pressable onPress={() => shift(-1)} hitSlop={8}>
              <Text
                style={{ color: t.tint, fontSize: 22, paddingHorizontal: 8 }}
              >
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
              <Text
                style={{ color: t.tint, fontSize: 22, paddingHorizontal: 8 }}
              >
                ›
              </Text>
            </Pressable>
          </View>
        )}

        {mode === "year" && yearData && (
          <View>
            <Text
              style={{
                textAlign: "center",
                fontSize: 13,
                color: t.label.tertiary,
                marginBottom: 10,
              }}
            >
              {yearData.days > 0
                ? `${yearData.days} gün · ${fmtTRY(yearData.total)}`
                : "Bu yıl gider yok"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 8,
                paddingVertical: 8,
              }}
              style={{
                backgroundColor: t.bg.elev,
                borderRadius: 12,
              }}
            >
              <View>
                {/* month labels */}
                <View
                  style={{
                    flexDirection: "row",
                    height: 14,
                    marginBottom: 4,
                  }}
                >
                  {Array.from({ length: yearData.weeks }).map((_, w) => {
                    const lab = yearData.monthLabels.find((x) => x.col === w);
                    return (
                      <View key={w} style={{ width: 11, marginRight: 2 }}>
                        {lab && (
                          <Text
                            style={{
                              fontSize: 9,
                              color: t.label.tertiary,
                              letterSpacing: 0.3,
                            }}
                          >
                            {lab.label}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {/* 7 rows × 53 weeks */}
                {Array.from({ length: 7 }).map((_, row) => (
                  <View
                    key={row}
                    style={{ flexDirection: "row", marginBottom: 2 }}
                  >
                    {Array.from({ length: yearData.weeks }).map((_, col) => {
                      const idx = col * 7 + row;
                      const c = yearData.cells[idx];
                      if (!c || !c.iso) {
                        return (
                          <View
                            key={col}
                            style={{
                              width: 11,
                              height: 11,
                              marginRight: 2,
                            }}
                          />
                        );
                      }
                      const isSel = c.iso === selected;
                      const baseAlpha =
                        c.level === 0
                          ? t.mode === "dark"
                            ? 0.06
                            : 0.12
                          : 0.22 + 0.2 * c.level; // 0.42, 0.62, 0.82, 1.02 → clamped
                      const bg =
                        c.level === 0
                          ? hexAlpha(t.label.tertiary, baseAlpha)
                          : hexAlpha(t.red, Math.min(1, baseAlpha));
                      return (
                        <Pressable
                          key={col}
                          onPress={() => setSelected(isSel ? null : c.iso)}
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: 2,
                            marginRight: 2,
                            backgroundColor: isSel ? t.tint : bg,
                          }}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {mode === "month" && (
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
        )}

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
