import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./Icon";

interface Props {
  uri: string | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function PhotoViewer({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = baseScale.value * e.scale;
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    })
    .onEnd(() => {
      baseScale.value = scale.value;
      if (scale.value < MIN_SCALE * 1.05) {
        scale.value = withSpring(MIN_SCALE);
        baseScale.value = MIN_SCALE;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const target = scale.value > MIN_SCALE * 1.5 ? MIN_SCALE : 2;
      scale.value = withSpring(target);
      baseScale.value = target;
    });

  const composed = Gesture.Simultaneous(pinch, doubleTap);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handleClose() {
    scale.value = MIN_SCALE;
    baseScale.value = MIN_SCALE;
    onClose();
  }

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable onPress={handleClose} style={StyleSheet.absoluteFill} />
        {uri && (
          <GestureDetector gesture={composed}>
            <Animated.View
              style={[StyleSheet.absoluteFill, imgStyle]}
              pointerEvents="box-none"
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </Animated.View>
          </GestureDetector>
        )}
        <View
          style={[
            styles.bar,
            {
              paddingTop: insets.top + 8,
              backgroundColor: "rgba(0,0,0,0.4)",
            },
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={12}
          >
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Fiş</Text>
          <View style={{ width: 32 }} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  title: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.4,
  },
});
