import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTheme } from "../theme/tokens";
import { fmtDate } from "../lib/format";

interface Props {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
}

export function DateField({
  value,
  onChange,
  placeholder = "Tarih seç",
  clearable,
}: Props) {
  const t = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const initial = value ? new Date(value) : new Date();

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode: "date",
        value: initial,
        onChange: (_, d) => {
          if (d) onChange(toISO(d));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  }

  function shift(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange(toISO(d));
  }

  const today = toISO(new Date());
  const yest = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISO(d);
  })();

  return (
    <View>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: t.bg.elev, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text
          style={{
            color: value ? t.label.primary : t.label.tertiary,
            fontSize: 17,
            letterSpacing: -0.2,
          }}
        >
          {value ? fmtDate(value) : placeholder}
        </Text>
        {clearable && value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10}>
            <Text style={{ color: t.label.tertiary, fontSize: 15 }}>
              Temizle
            </Text>
          </Pressable>
        )}
      </Pressable>
      <View style={styles.shortcuts}>
        <Pressable
          onPress={() => shift(0)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Bugün"
        >
          <Text
            style={[
              styles.shortcut,
              { color: value === today ? t.tint : t.label.secondary },
            ]}
          >
            Bugün
          </Text>
        </Pressable>
        <Pressable
          onPress={() => shift(-1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dün"
        >
          <Text
            style={[
              styles.shortcut,
              { color: value === yest ? t.tint : t.label.secondary },
            ]}
          >
            Dün
          </Text>
        </Pressable>
        <Pressable
          onPress={() => shift(-2)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Önceki gün"
        >
          <Text style={[styles.shortcut, { color: t.label.secondary }]}>
            Önceki
          </Text>
        </Pressable>
      </View>
      {iosOpen && Platform.OS === "ios" && (
        <View
          style={{
            backgroundColor: t.bg.elev,
            borderRadius: 12,
            marginTop: 6,
            padding: 4,
          }}
        >
          <DateTimePicker
            value={initial}
            mode="date"
            display="inline"
            themeVariant={t.mode}
            locale="tr-TR"
            onChange={(_, d) => {
              if (d) onChange(toISO(d));
            }}
          />
        </View>
      )}
    </View>
  );
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, android: 12 }),
  },
  shortcuts: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  shortcut: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: -0.2,
    paddingVertical: 4,
  },
});
