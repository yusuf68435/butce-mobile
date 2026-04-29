import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme/tokens";

interface Props {
  /** 0..1; values >1 are clamped visually but flagged via overflow tone. */
  pct: number;
  size?: number;
  stroke?: number;
  /** Force a tone instead of pct-derived (default: green<70, orange<100, red≥100). */
  tone?: "good" | "warn" | "bad";
}

export function Ring({ pct, size = 28, stroke = 4, tone }: Props) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  const overflow = pct > 1;
  const auto: "good" | "warn" | "bad" = overflow
    ? "bad"
    : pct >= 0.85
      ? "warn"
      : "good";
  const color =
    (tone ?? auto) === "bad"
      ? t.red
      : (tone ?? auto) === "warn"
        ? t.orange
        : t.green;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.label.quaternary}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          fill="none"
          // rotate so the ring starts from 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
