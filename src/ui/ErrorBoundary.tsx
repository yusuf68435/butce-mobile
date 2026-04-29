import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
  /** Optional reset hook — e.g. clear cache, reload data. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  info: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    this.setState({ info });
    // Fire-and-forget local persistence (no network).
    import("../lib/errorLog")
      .then((m) =>
        m.logError(
          "ErrorBoundary",
          new Error(`${error.message}\n${info.componentStack ?? ""}`),
        ),
      )
      .catch(() => {});
  }

  reset = () => {
    this.setState({ error: null, info: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const stack = this.state.error.stack ?? this.state.error.message;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.body}>
          Hata yakalandı, uygulama kapanmadı. Verin korunuyor.
        </Text>
        <Pressable
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Tekrar dene"
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.btnLabel}>Tekrar dene</Text>
        </Pressable>
        {__DEV__ && (
          <ScrollView
            style={styles.debug}
            contentContainerStyle={{ padding: 12 }}
          >
            <Text style={styles.debugText}>{stack}</Text>
          </ScrollView>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  body: {
    color: "rgba(235,235,245,0.6)",
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.2,
    textAlign: "center",
    lineHeight: 21,
  },
  btn: {
    marginTop: 16,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: "#0a84ff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  debug: {
    marginTop: 28,
    width: "100%",
    maxHeight: 240,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  debugText: {
    color: "rgba(235,235,245,0.6)",
    fontSize: 11,
    fontFamily: "Menlo",
  },
});
