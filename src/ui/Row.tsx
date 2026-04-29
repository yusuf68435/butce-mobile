import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Swipeable } from "react-native-gesture-handler";
import { useTheme, RowColor, rowColorHex } from "../theme/tokens";
import { IconName } from "../lib/constants";
import { Icon } from "./Icon";
import { notifyWarning, selectionTap } from "../lib/haptics";

type ValueTone = "default" | "pos" | "neg" | "muted";

export interface SwipeAction {
  label: string;
  tone: "danger" | "primary" | "warning";
  onPress: () => void;
}

interface Props {
  icon?: IconName;
  iconColor?: RowColor;
  title: string;
  sub?: string;
  value?: string;
  valueTone?: ValueTone;
  valueBold?: boolean;
  valueStack?: { value: string; sub: string; subTone?: ValueTone };
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  isLast?: boolean;
  isFirst?: boolean;
  rightSlot?: React.ReactNode;
  /** Trailing swipe actions, rendered right-to-left. */
  swipeActions?: SwipeAction[];
  /** When set, a 28×28 thumb is rendered before the value. */
  thumbUri?: string | null;
}

export function Row({
  icon,
  iconColor = "gray",
  title,
  sub,
  value,
  valueTone = "default",
  valueBold,
  valueStack,
  chevron,
  onPress,
  onLongPress,
  isFirst,
  isLast: _isLast,
  rightSlot,
  swipeActions,
  thumbUri,
}: Props) {
  const t = useTheme();
  const Wrapper = (
    onPress || onLongPress ? Pressable : View
  ) as React.ComponentType<{
    onPress?: () => void;
    onLongPress?: () => void;
    delayLongPress?: number;
    android_ripple?: { color: string };
    accessibilityRole?: "button" | "text";
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityActions?: { name: string; label: string }[];
    onAccessibilityAction?: (e: {
      nativeEvent: { actionName: string };
    }) => void;
    style?: unknown;
    children?: React.ReactNode;
  }>;
  const inner = (
    <Wrapper
      onPress={onPress}
      onLongPress={
        onLongPress
          ? () => {
              selectionTap();
              onLongPress();
            }
          : undefined
      }
      delayLongPress={350}
      android_ripple={onPress ? { color: t.bg.fill } : undefined}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[
        title,
        sub,
        valueStack ? `${valueStack.value} ${valueStack.sub}` : value,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={onPress ? "Aç" : undefined}
      accessibilityActions={
        swipeActions?.length
          ? swipeActions.map((a) => ({ name: a.label, label: a.label }))
          : undefined
      }
      onAccessibilityAction={
        swipeActions?.length
          ? (e: { nativeEvent: { actionName: string } }) => {
              const a = swipeActions.find(
                (x) => x.label === e.nativeEvent.actionName,
              );
              a?.onPress();
            }
          : undefined
      }
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        { backgroundColor: t.bg.elev },
        pressed && onPress && { backgroundColor: t.bg.fill },
      ]}
    >
      {!isFirst && (
        <View
          style={[
            styles.sep,
            { backgroundColor: t.separator, left: icon ? 60 : 16 },
          ]}
        />
      )}
      {icon && (
        <View
          style={[
            styles.iconBox,
            { backgroundColor: rowColorHex(t, iconColor) },
          ]}
        >
          <Icon
            name={icon}
            size={18}
            color={iconColor === "yellow" ? "#000" : "#fff"}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: t.label.primary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.5}
        >
          {title}
        </Text>
        {sub && (
          <Text
            style={[styles.sub, { color: t.label.secondary }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {sub}
          </Text>
        )}
      </View>
      {valueStack ? (
        <View style={styles.stack}>
          <Text style={[styles.value, styles.bold, { color: t.label.primary }]}>
            {valueStack.value}
          </Text>
          <Text
            style={[
              styles.stackSub,
              { color: toneColor(t, valueStack.subTone || "default") },
            ]}
          >
            {valueStack.sub}
          </Text>
        </View>
      ) : value != null ? (
        <Text
          style={[
            styles.value,
            valueBold && styles.bold,
            { color: toneColor(t, valueTone) },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
        >
          {value}
        </Text>
      ) : null}
      {thumbUri && (
        <Image
          source={{ uri: thumbUri }}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      )}
      {rightSlot}
      {chevron && (
        <View style={{ marginLeft: 4 }}>
          <Icon name="chevron-right" size={14} color={t.label.tertiary} />
        </View>
      )}
    </Wrapper>
  );

  if (!swipeActions?.length) return inner;

  return (
    <Swipeable
      friction={1.6}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <View style={{ flexDirection: "row" }}>
          {swipeActions.map((a, idx) => (
            <Pressable
              key={`${a.label}-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                if (a.tone === "danger") notifyWarning();
                else selectionTap();
                a.onPress();
              }}
              style={{
                paddingHorizontal: 18,
                justifyContent: "center",
                backgroundColor:
                  a.tone === "danger"
                    ? t.red
                    : a.tone === "warning"
                      ? t.orange
                      : t.tint,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "600",
                  letterSpacing: -0.2,
                }}
                maxFontSizeMultiplier={1.3}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      {inner}
    </Swipeable>
  );
}

function toneColor(t: ReturnType<typeof useTheme>, tone: ValueTone): string {
  switch (tone) {
    case "pos":
      return t.green;
    case "neg":
      return t.red;
    case "muted":
      return t.label.secondary;
    default:
      return t.label.primary;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 12,
    position: "relative",
  },
  sep: {
    position: "absolute",
    top: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 1, letterSpacing: -0.1 },
  value: { fontSize: 17, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  bold: { fontWeight: "600" },
  stack: { alignItems: "flex-end", gap: 1 },
  stackSub: { fontSize: 13, fontVariant: ["tabular-nums"] },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
});

interface EmptyProps {
  children: string;
  /** Big SF symbol-style glyph above the text. */
  icon?: IconName;
  iconColor?: RowColor;
  /** Inline call-to-action (renders as tinted button below). */
  cta?: { label: string; onPress: () => void };
}

export function RowEmpty({ children, icon, iconColor, cta }: EmptyProps) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.bg.elev,
        paddingVertical: 32,
        paddingHorizontal: 16,
        alignItems: "center",
        gap: 10,
      }}
    >
      {icon && (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: iconColor
              ? rowColorHex(t, iconColor) + "22"
              : t.bg.fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={icon}
            size={22}
            color={iconColor ? rowColorHex(t, iconColor) : t.label.tertiary}
          />
        </View>
      )}
      <Text
        style={{
          color: t.label.tertiary,
          fontSize: 14,
          textAlign: "center",
          letterSpacing: -0.1,
        }}
        maxFontSizeMultiplier={1.4}
      >
        {children}
      </Text>
      {cta && (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          hitSlop={8}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: t.tint + "26",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: t.tint,
              fontSize: 14,
              fontWeight: "600",
              letterSpacing: -0.1,
            }}
          >
            {cta.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
