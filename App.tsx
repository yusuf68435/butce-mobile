import React, { useEffect, useRef, useState } from "react";
import {
  AppState as RNAppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "./src/theme/tokens";
import {
  didHydrationFail,
  Store,
  useHydrate,
  useHydrated,
  useStore,
} from "./src/store/store";
import { Icon } from "./src/ui/Icon";
import { CashScreen } from "./src/screens/CashScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { authenticate } from "./src/lib/biometric";
import { ErrorBoundary } from "./src/ui/ErrorBoundary";
import { Alert } from "react-native";

const AUTO_LOCK_MS = 60_000;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ErrorBoundary>
            <Root />
          </ErrorBoundary>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const t = useTheme();
  useHydrate();
  const hydrated = useHydrated();
  const onboarded = useStore((s) => !!s.settings.onboarded);
  const biometricLock = useStore((s) => !!s.settings.biometricLock);

  // One-shot warning if AsyncStorage read/parse failed during hydrate.
  // App keeps running on a fresh-state fallback, but the existing data on
  // disk is preserved (we don't overwrite). User can attempt a backup
  // import to recover, or restart the app.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || warnedRef.current) return;
    if (didHydrationFail()) {
      warnedRef.current = true;
      Alert.alert(
        "Veriler okunamadı",
        "Cihazdaki kayıtlı veri okunamadı. Mevcut yedeğin varsa Ayarlar → Yedekten Yükle yolundan geri yükle.\n\nKayıtlı veri silinmedi, yalnızca okunamadı.",
      );
    }
  }, [hydrated]);

  // Lock state: when biometric is enabled, app starts locked.
  const [locked, setLocked] = useState(biometricLock);
  const backgroundedAt = useRef<number | null>(null);

  // Re-arm lock when settings change (toggling on while running).
  useEffect(() => {
    if (biometricLock) setLocked(true);
    else setLocked(false);
  }, [biometricLock]);

  // Auto-lock after backgrounding for AUTO_LOCK_MS.
  useEffect(() => {
    if (!biometricLock) return;
    const sub = RNAppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        backgroundedAt.current = Date.now();
      } else if (next === "active") {
        const since = backgroundedAt.current;
        if (since && Date.now() - since >= AUTO_LOCK_MS) {
          setLocked(true);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricLock]);

  async function unlock() {
    const ok = await authenticate("Bütçe'yi aç");
    if (ok) setLocked(false);
  }

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: t.bg.grouped }} />;
  }

  if (!onboarded) {
    return (
      <>
        <StatusBar
          barStyle={t.mode === "dark" ? "light-content" : "dark-content"}
        />
        <OnboardingScreen
          onDone={() =>
            Store.update((s) => {
              s.settings.onboarded = true;
            })
          }
        />
      </>
    );
  }

  if (biometricLock && locked) {
    return (
      <>
        <StatusBar
          barStyle={t.mode === "dark" ? "light-content" : "dark-content"}
        />
        <LockScreen tint={t.tint} bg={t.bg.grouped} onUnlock={unlock} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.grouped }}>
      <StatusBar
        barStyle={t.mode === "dark" ? "light-content" : "dark-content"}
      />
      <CashScreen />
    </View>
  );
}

function LockScreen({
  tint,
  bg,
  onUnlock,
}: {
  tint: string;
  bg: string;
  onUnlock: () => void;
}) {
  // Auto-prompt biometric on mount + on tap.
  useEffect(() => {
    onUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          backgroundColor: tint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="wallet" size={48} color="#fff" />
      </View>
      <Pressable
        onPress={onUnlock}
        accessibilityRole="button"
        accessibilityLabel="Kilidi aç"
        hitSlop={16}
      >
        <Text style={{ color: tint, fontSize: 17, fontWeight: "600" }}>
          Kilidi aç
        </Text>
      </Pressable>
    </View>
  );
}

const _styles = StyleSheet.create({});
