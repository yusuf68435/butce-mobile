import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/tokens";

interface Item {
  name: string;
  amount: string;
  pct: number;
  color: string;
}

export function ChartList({ items }: { items: Item[] }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.bg.elev }}>
      {items.map((it, i) => (
        <View
          key={i}
          style={[
            styles.row,
            i > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: t.separator,
            },
          ]}
        >
          <View style={styles.head}>
            <View style={styles.name}>
              <View style={[styles.dot, { backgroundColor: it.color }]} />
              <Text
                style={{
                  color: t.label.primary,
                  fontSize: 15,
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {it.name}
              </Text>
            </View>
            <Text
              style={{
                color: t.label.secondary,
                fontSize: 15,
                fontVariant: ["tabular-nums"],
              }}
            >
              {it.amount} · {it.pct.toFixed(0)}%
            </Text>
          </View>
          <View style={[styles.bar, { backgroundColor: t.bg.fill }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(2, it.pct)}%`, backgroundColor: it.color },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export const CHART_PALETTE = [
  "#007aff",
  "#ff9500",
  "#af52de",
  "#ff2d55",
  "#5ac8fa",
  "#5856d6",
  "#34c759",
  "#ffcc00",
];

const styles = StyleSheet.create({
  row: { paddingVertical: 11, paddingHorizontal: 16, gap: 6 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
});
