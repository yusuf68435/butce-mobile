// Tek-kullanıcı (Personal Edition) için minimum onboarding.
// Bir kez gösterilir; kullanıcı "Başlayalım" der → Cash ekranına gider.
// Açılış bakiyesi/bildirim ayarları sonradan Settings + TxSheet'ten zaten yapılır.

import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/tokens";
import { Icon } from "../ui/Icon";
import { notifySuccess, tapLight } from "../lib/haptics";

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scale = React.useRef(new Animated.Value(1)).current;

  function start() {
    tapLight();
    notifySuccess();
    onDone();
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: t.bg.grouped,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: t.tint }]}>
        <Icon name="wallet" size={56} color="#fff" />
      </View>

      <Text style={[styles.title, { color: t.label.primary }]}>Bütçe</Text>
      <Text style={[styles.body, { color: t.label.secondary }]}>
        Tüm verin cihazında kalır. Sunucu yok, hesap yok, takip yok.{"\n\n"}
        Hareketlerini ekle, ay sonunda nereye gittiğini gör.
      </Text>

      <View style={{ flex: 1 }} />

      <Pressable
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }).start()
        }
        onPress={start}
        accessibilityRole="button"
        accessibilityLabel="Başlayalım"
      >
        <Animated.View
          style={[
            styles.btn,
            { backgroundColor: t.tint, transform: [{ scale }] },
          ]}
        >
          <Text style={styles.btnLabel}>Başlayalım</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 17,
    fontWeight: "400",
    letterSpacing: -0.3,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  btn: {
    height: 50,
    paddingHorizontal: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
});
