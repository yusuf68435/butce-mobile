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
import { Icon } from "../ui/Icon";
import { useTheme } from "../theme/tokens";
import { useStore } from "../store/store";
import {
  TR_MONTHS_SHORT,
  currentMonthKey,
  fmtMonthLabel,
  fmtSigned,
  fmtTRY,
  monthKeyOf,
} from "../lib/format";

export interface MonthPickerRef {
  open: (current: string) => void;
}

interface Props {
  onSelect: (key: string) => void;
}

export const MonthPickerSheet = forwardRef<MonthPickerRef, Props>(
  function MonthPickerSheet({ onSelect }, ref) {
    const sheet = useRef<SheetRef>(null);
    const t = useTheme();
    const transactions = useStore((s) => s.transactions);
    const [year, setYear] = useState(new Date().getFullYear());
    const [active, setActive] = useState<string>(currentMonthKey());

    useImperativeHandle(
      ref,
      () => ({
        open(current) {
          setActive(current);
          setYear(Number(current.split("-")[0]));
          sheet.current?.open();
        },
      }),
      [],
    );

    const txMonths = useMemo(() => {
      const set = new Set<string>();
      for (const t of transactions) set.add(monthKeyOf(t.date));
      return set;
    }, [transactions]);

    const history = useMemo(() => {
      const map = new Map<string, { income: number; expense: number }>();
      for (const tx of transactions) {
        const k = monthKeyOf(tx.date);
        if (!map.has(k)) map.set(k, { income: 0, expense: 0 });
        const b = map.get(k)!;
        if (tx.type === "income") b.income += tx.amount;
        else b.expense += tx.amount;
      }
      return [...map.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6);
    }, [transactions]);

    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;

    function pick(key: string) {
      onSelect(key);
      sheet.current?.close();
    }

    function today() {
      const k = currentMonthKey();
      onSelect(k);
      sheet.current?.close();
    }

    return (
      <Sheet
        ref={sheet}
        title="Ay Seç"
        cancelLabel="Kapat"
        actionLabel="Bu Ay"
        onAction={today}
      >
        <View style={styles.yearNav}>
          <Pressable
            onPress={() => setYear((y) => y - 1)}
            style={({ pressed }) => [
              styles.yearBtn,
              { backgroundColor: t.bg.fill, opacity: pressed ? 0.5 : 1 },
            ]}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={16} color={t.tint} />
          </Pressable>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: t.label.primary,
              minWidth: 80,
              textAlign: "center",
              letterSpacing: -0.4,
            }}
          >
            {year}
          </Text>
          <Pressable
            onPress={() => setYear((y) => y + 1)}
            style={({ pressed }) => [
              styles.yearBtn,
              { backgroundColor: t.bg.fill, opacity: pressed ? 0.5 : 1 },
            ]}
            hitSlop={8}
          >
            <Icon name="chevron-right" size={16} color={t.tint} />
          </Pressable>
        </View>

        <View style={[styles.grid, { backgroundColor: t.bg.elev }]}>
          {TR_MONTHS_SHORT.map((label, i) => {
            const m = i + 1;
            const key = `${year}-${String(m).padStart(2, "0")}`;
            const isActive = key === active;
            const isCurrent = year === cy && m === cm;
            const isFuture = year > cy || (year === cy && m > cm);
            const hasData = txMonths.has(key);
            return (
              <Pressable
                key={key}
                onPress={() => pick(key)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: isActive ? hexA(t.tint, 0.16) : t.bg.fill,
                    borderColor: isActive ? t.tint : "transparent",
                    opacity: pressed ? 0.6 : isFuture ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "500",
                    color: isActive
                      ? t.tint
                      : isCurrent
                        ? t.tint
                        : isFuture
                          ? t.label.tertiary
                          : t.label.primary,
                  }}
                >
                  {label}
                </Text>
                {hasData && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isActive
                          ? t.tint
                          : isCurrent
                            ? t.tint
                            : t.label.tertiary,
                      },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Grouped header="Son Aylar">
          {history.length === 0 ? (
            <RowEmpty>Henüz veri yok.</RowEmpty>
          ) : (
            history.map(([k, b], i) => {
              const bal = b.income - b.expense;
              return (
                <Row
                  key={k}
                  title={fmtMonthLabel(k)}
                  sub={`Gelir ${fmtTRY(b.income)} · Gider ${fmtTRY(b.expense)}`}
                  value={fmtSigned(bal)}
                  valueTone={bal >= 0 ? "pos" : "neg"}
                  onPress={() => pick(k)}
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

function hexA(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  yearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 8,
    borderRadius: 12,
  },
  cell: {
    width: "31%",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: "absolute",
    bottom: 4,
  },
});
