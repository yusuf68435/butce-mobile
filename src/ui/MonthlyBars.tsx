import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { fmtTRY, TR_MONTHS, TR_MONTHS_SHORT } from "../lib/format";
import { MonthlyTotal } from "../store/selectors";

interface Props {
  data: MonthlyTotal[];
  height?: number;
}

export function MonthlyBars({ data, height = 140 }: Props) {
  const t = useTheme();
  const peak = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg.elev }]}>
      <View style={[styles.chart, { height }]}>
        {data.map((d) => {
          const inH = (d.income / peak) * (height - 24);
          const exH = (d.expense / peak) * (height - 24);
          const [, mStr] = d.key.split("-").map(Number);
          const monthName = TR_MONTHS[(mStr ?? 1) - 1] || "";
          return (
            <View
              key={d.key}
              style={styles.col}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${monthName}: gelir ${fmtTRY(d.income)}, gider ${fmtTRY(d.expense)}`}
            >
              <View style={styles.barsRow}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, inH),
                      backgroundColor: t.green,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, exH),
                      backgroundColor: t.red,
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.lbl, { color: t.label.tertiary }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {labelOf(d.key)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Legend color={t.green} label="Gelir" />
        <Legend color={t.red} label="Gider" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }}
      />
      <Text style={{ fontSize: 12, color: t.label.secondary }}>{label}</Text>
    </View>
  );
}

function labelOf(key: string): string {
  const [, m] = key.split("-").map(Number);
  return TR_MONTHS_SHORT[m - 1] || "";
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    flex: 1,
  },
  bar: {
    width: 5,
    borderRadius: 2,
  },
  lbl: {
    fontSize: 10,
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
