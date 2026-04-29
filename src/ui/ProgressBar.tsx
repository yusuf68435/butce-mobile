import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/tokens";

interface Props {
  pct: number;
  tone?: "default" | "good" | "warn" | "over";
  height?: number;
}

export function ProgressBar({ pct, tone, height = 4 }: Props) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    tone === "over"
      ? t.red
      : tone === "warn"
        ? t.orange
        : tone === "good"
          ? t.green
          : t.tint;
  return (
    <View
      style={[
        styles.track,
        { backgroundColor: t.bg.fill, height, borderRadius: height / 2 },
      ]}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function toneFromPct(pct: number): "default" | "warn" | "over" {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "default";
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
});
