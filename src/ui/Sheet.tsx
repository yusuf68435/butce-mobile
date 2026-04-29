import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useTheme } from "../theme/tokens";
import { tapLight } from "../lib/haptics";
import { useReduceMotion } from "../theme/a11y";

export interface SheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  title: string;
  cancelLabel?: string;
  onCancel?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  children: React.ReactNode;
  scroll?: boolean;
  /** Detents. Default: ['55%', '92%'] (medium + large). */
  snapPoints?: string[];
  /** Force single large detent. */
  largeOnly?: boolean;
}

export const Sheet = forwardRef<SheetRef, Props>(function Sheet(
  {
    title,
    cancelLabel = "İptal",
    onCancel,
    actionLabel,
    onAction,
    actionDisabled,
    children,
    scroll = true,
    snapPoints,
    largeOnly,
  },
  ref,
) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const sheetRef = useRef<BottomSheet>(null);
  const snaps = useMemo(
    () => snapPoints ?? (largeOnly ? ["92%"] : ["55%", "92%"]),
    [snapPoints, largeOnly],
  );

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        tapLight();
        // Open at largest detent so initial render doesn't clip.
        sheetRef.current?.snapToIndex(snaps.length - 1);
      },
      close: () => sheetRef.current?.close(),
    }),
    [snaps.length],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const Container = (
    scroll ? BottomSheetScrollView : BottomSheetView
  ) as React.ComponentType<{
    style?: unknown;
    contentContainerStyle?: unknown;
    children?: React.ReactNode;
  }>;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snaps}
      enablePanDownToClose
      index={-1}
      animationConfigs={
        reduceMotion ? { duration: 1, overshootClamping: true } : undefined
      }
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: t.mode === "dark" ? t.bg.elev : t.bg.grouped,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
      }}
      handleIndicatorStyle={{
        backgroundColor: t.label.tertiary,
        width: 36,
        height: 5,
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.nav}>
        <Pressable
          onPress={() => (onCancel ? onCancel() : sheetRef.current?.close())}
          hitSlop={8}
        >
          <Text style={{ color: t.tint, fontSize: 17 }}>{cancelLabel}</Text>
        </Pressable>
        <Text
          style={[styles.title, { color: t.label.primary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {onAction ? (
          <Pressable onPress={onAction} hitSlop={8} disabled={actionDisabled}>
            <Text
              style={{
                color: actionDisabled ? t.label.tertiary : t.tint,
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
      <Container
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          paddingTop: 8,
          gap: 24,
        }}
      >
        {children}
      </Container>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.4,
    marginHorizontal: 8,
  },
});
