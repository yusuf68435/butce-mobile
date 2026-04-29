import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/tokens";
import { Icon } from "./Icon";
import { selectionTap } from "../lib/haptics";

/* ---------- Pill ---------- */

export function Pill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Seç"
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: hexAlpha(t.tint, 0.15), opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color: t.tint, fontSize: 15, fontWeight: "600" }}>
        {label}
      </Text>
      <Icon name="chevron-down" size={13} color={t.tint} strokeWidth={2.4} />
    </Pressable>
  );
}

/* ---------- Chip ---------- */

interface ChipProps {
  label: string;
  active?: boolean;
  add?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active, add, onPress }: ChipProps) {
  const t = useTheme();
  const inactiveBg = t.mode === "dark" ? t.bg.tertiary : t.bg.grouped;
  const bg = add ? "transparent" : active ? hexAlpha(t.tint, 0.15) : inactiveBg;
  const color = add ? t.label.secondary : active ? t.tint : t.label.primary;
  const borderColor = add ? t.separator : active ? t.tint : "transparent";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: active ? 1.5 : add ? 1 : 0,
          borderStyle: add ? "dashed" : "solid",
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={{ color, fontSize: 14, fontWeight: active ? "600" : "500" }}
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGrid({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View style={[styles.chipGrid, { backgroundColor: t.bg.elev }, style]}>
      {children}
    </View>
  );
}

/* ---------- Segmented ---------- */

interface SegProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegProps<T>) {
  const t = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: t.bg.fill }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (!active) selectionTap();
              onChange(o.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            style={[
              styles.segOpt,
              active && {
                backgroundColor: t.mode === "dark" ? "#636366" : t.bg.elev,
                shadowColor: "#000",
                shadowOpacity: t.mode === "dark" ? 0 : 0.06,
                shadowOffset: { width: 0, height: 3 },
                shadowRadius: 8,
                elevation: 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: active ? "600" : "500",
                color: t.label.primary,
                letterSpacing: -0.1,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Field (label + input wrapper) ---------- */

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontSize: 13,
        letterSpacing: 0.78,
        color: t.label.secondary,
        paddingHorizontal: 16,
        paddingBottom: 6,
        fontWeight: "400",
      }}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

/* ---------- DestructiveButton ---------- */

export function DestructiveButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.destruct,
        { backgroundColor: pressed ? t.bg.fill : t.bg.elev },
      ]}
    >
      <Text style={{ color: t.red, fontSize: 17, letterSpacing: -0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------- Helpers ---------- */

function hexAlpha(hex: string, a: number): string {
  // hex like #RRGGBB or rgba/rgb passthrough
  if (!hex.startsWith("#")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 999,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  seg: {
    flexDirection: "row",
    padding: 2,
    borderRadius: 9,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: "center",
  },
  destruct: {
    padding: 13,
    borderRadius: 10,
    alignItems: "center",
  },
});
