import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/tokens";

interface Props {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Grouped({ header, footer, children, style }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.section, style]}>
      {header && (
        <Text style={[styles.header, { color: t.label.secondary }]}>
          {header.toUpperCase()}
        </Text>
      )}
      <View style={[styles.body, { backgroundColor: t.bg.elev }]}>
        {children}
      </View>
      {footer && (
        <Text style={[styles.footer, { color: t.label.secondary }]}>
          {footer}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%" },
  header: {
    fontSize: 13,
    letterSpacing: 0.78,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
    fontWeight: "400",
  },
  body: {
    borderRadius: 10,
    overflow: "hidden",
  },
  footer: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 6,
    lineHeight: 18,
  },
});
