import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { useReduceMotion } from "../theme/a11y";

interface MetaItem {
  label: string;
  tone?: "default" | "pos" | "neg";
}

interface Props {
  eyebrow: string;
  amount: string;
  meta?: MetaItem[];
  compact?: boolean;
}

export function Hero({ eyebrow, amount, meta, compact }: Props) {
  const t = useTheme();
  const huge = !compact && amount.length < 14;
  const reduceMotion = useReduceMotion();

  // Subtle bounce + opacity flicker when amount changes.
  // Reduce Motion respects user accessibility setting.
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const lastAmount = useRef(amount);

  useEffect(() => {
    if (lastAmount.current === amount) return;
    lastAmount.current = amount;
    if (reduceMotion) return;
    scale.setValue(0.97);
    opacity.setValue(0.4);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [amount, opacity, reduceMotion, scale]);

  return (
    <View style={styles.hero}>
      <Text
        style={[styles.eyebrow, { color: t.label.secondary }]}
        maxFontSizeMultiplier={1.4}
      >
        {eyebrow.toUpperCase()}
      </Text>
      <Animated.Text
        style={[
          styles.amount,
          {
            color: t.label.primary,
            fontSize: huge ? 44 : 36,
            letterSpacing: huge ? -1.6 : -1.2,
            transform: [{ scale }],
            opacity,
          },
        ]}
        maxFontSizeMultiplier={1.3}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {amount}
      </Animated.Text>
      {meta && meta.length > 0 && (
        <View style={styles.metaRow}>
          {meta.map((m, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <Text style={[styles.dot, { color: t.label.quaternary }]}>
                  •
                </Text>
              )}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.2,
                  color:
                    m.tone === "pos"
                      ? t.green
                      : m.tone === "neg"
                        ? t.red
                        : t.label.secondary,
                }}
              >
                {m.label}
              </Text>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 18, gap: 6 },
  eyebrow: { fontSize: 13, fontWeight: "400", letterSpacing: 0.78 },
  amount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 50,
    marginTop: 2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  dot: { fontSize: 14 },
});
