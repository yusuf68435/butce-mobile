import React from "react";
import { Platform, StyleSheet, TextInput, TextInputProps } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useTheme } from "../theme/tokens";

interface Props extends TextInputProps {
  inSheet?: boolean;
}

export function TextField({ inSheet, style, ...rest }: Props) {
  const t = useTheme();
  const Input = (
    inSheet ? BottomSheetTextInput : TextInput
  ) as React.ComponentType<TextInputProps>;
  return (
    <Input
      placeholderTextColor={t.label.tertiary}
      style={[
        styles.input,
        {
          backgroundColor: t.bg.elev,
          color: t.label.primary,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 14, android: 10 }),
    fontSize: 17,
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
});
