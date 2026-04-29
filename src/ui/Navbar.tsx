import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { Icon } from "./Icon";
import { IconName } from "../lib/constants";

interface Action {
  icon: IconName;
  onPress: () => void;
  onLongPress?: () => void;
  label?: string;
}

interface Props {
  title: string;
  leading?: Action | Action[];
  trailing?: Action | Action[];
}

function asArr(a?: Action | Action[]): Action[] {
  if (!a) return [];
  return Array.isArray(a) ? a : [a];
}

export function Navbar({ title, leading, trailing }: Props) {
  const t = useTheme();
  const lead = asArr(leading);
  const trail = asArr(trailing);
  return (
    <View style={styles.bar}>
      <View style={[styles.slot, { width: 44 * Math.max(1, lead.length) }]}>
        {lead.map((a, i) => (
          <NavBtn key={i} {...a} tint={t.tint} />
        ))}
      </View>
      <Text
        style={[styles.title, { color: t.label.primary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View
        style={[
          styles.slot,
          {
            width: 44 * Math.max(1, trail.length),
            flexDirection: "row",
            justifyContent: "flex-end",
          },
        ]}
      >
        {trail.map((a, i) => (
          <NavBtn key={i} {...a} tint={t.tint} />
        ))}
      </View>
    </View>
  );
}

const A11Y_LABELS: Record<string, string> = {
  gear: "Ayarlar",
  plus: "Yeni hareket",
  search: "Ara",
  calendar: "Takvim",
  bell: "Bildirimler",
  chart: "Trendler",
  sparkles: "Akıllı özet",
  refresh: "Yenile",
  "chevron-left": "Geri",
  "chevron-right": "İleri",
};

function NavBtn({
  icon,
  onPress,
  onLongPress,
  label,
  tint,
}: Action & { tint: string }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={label || A11Y_LABELS[icon] || icon}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.4 : 1 }]}
      hitSlop={8}
    >
      <Icon name={icon} size={22} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 4,
  },
  slot: { flexDirection: "row", alignItems: "center" },
  btn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.4,
  },
});
