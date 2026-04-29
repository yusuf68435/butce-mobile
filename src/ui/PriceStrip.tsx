import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { fetchPrices, getCachedPrices, Prices } from "../lib/prices";
import { fmtTRY } from "../lib/format";

interface Props {
  onPress?: () => void;
}

export function PriceStrip({ onPress }: Props) {
  const t = useTheme();
  const [prices, setPrices] = useState<Prices | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCachedPrices().then((p) => {
      if (!cancelled && p) setPrices(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    if (loading) return;
    setLoading(true);
    try {
      const p = await fetchPrices(true);
      if (p) setPrices(p);
    } finally {
      setLoading(false);
    }
  }

  const items: { label: string; value: number }[] = prices
    ? [
        { label: "Altın", value: prices.gold },
        { label: "USD", value: prices.usd },
        { label: "EUR", value: prices.eur },
      ].filter((x) => x.value > 0)
    : [];

  if (items.length === 0) {
    return (
      <Pressable
        onPress={onPress ?? refresh}
        style={({ pressed }) => [
          styles.wrap,
          { backgroundColor: t.bg.elev, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={{ color: t.label.tertiary, fontSize: 13 }}>
          {loading ? "Yükleniyor…" : "Fiyatları çekmek için dokun"}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress ?? refresh}
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: t.bg.elev, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 && (
            <View style={[styles.sep, { backgroundColor: t.separator }]} />
          )}
          <View style={styles.cell}>
            <Text style={[styles.label, { color: t.label.tertiary }]}>
              {it.label}
            </Text>
            <Text style={[styles.value, { color: t.label.primary }]}>
              {fmtTRY(it.value)}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  label: { fontSize: 11, fontWeight: "500", letterSpacing: 0.66 },
  value: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.2,
  },
});
