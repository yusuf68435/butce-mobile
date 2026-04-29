import React from "react";
import {
  PixelRatio,
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextProps,
  TextStyle,
} from "react-native";
import { useTheme } from "../theme/tokens";

export type TextRole =
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "callout"
  | "subheadline"
  | "footnote"
  | "caption1"
  | "caption2";

interface Spec {
  size: number;
  weight: TextStyle["fontWeight"];
  letterSpacing: number;
  lineHeight: number;
}

// Apple HIG iOS 17 type scale (default content size category Large).
const TYPE: Record<TextRole, Spec> = {
  largeTitle: { size: 34, weight: "700", letterSpacing: -0.5, lineHeight: 41 },
  title1: { size: 28, weight: "700", letterSpacing: -0.4, lineHeight: 34 },
  title2: { size: 22, weight: "700", letterSpacing: -0.4, lineHeight: 28 },
  title3: { size: 20, weight: "600", letterSpacing: -0.3, lineHeight: 25 },
  headline: { size: 17, weight: "600", letterSpacing: -0.4, lineHeight: 22 },
  body: { size: 17, weight: "400", letterSpacing: -0.4, lineHeight: 22 },
  callout: { size: 16, weight: "400", letterSpacing: -0.3, lineHeight: 21 },
  subheadline: { size: 15, weight: "400", letterSpacing: -0.2, lineHeight: 20 },
  footnote: { size: 13, weight: "400", letterSpacing: -0.1, lineHeight: 18 },
  caption1: { size: 12, weight: "400", letterSpacing: 0, lineHeight: 16 },
  caption2: { size: 11, weight: "400", letterSpacing: 0.06, lineHeight: 13 },
};

export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "tint"
  | "pos"
  | "neg"
  | "inherit";

interface AppTextProps extends Omit<TextProps, "style" | "role"> {
  role?: TextRole;
  tone?: TextTone;
  weight?: TextStyle["fontWeight"];
  tabular?: boolean;
  align?: TextStyle["textAlign"];
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function AppText({
  role = "body",
  tone = "primary",
  weight,
  tabular,
  align,
  uppercase,
  style,
  children,
  ...rest
}: AppTextProps) {
  const t = useTheme();
  const spec = TYPE[role];

  const color =
    tone === "primary"
      ? t.label.primary
      : tone === "secondary"
        ? t.label.secondary
        : tone === "tertiary"
          ? t.label.tertiary
          : tone === "tint"
            ? t.tint
            : tone === "pos"
              ? t.green
              : tone === "neg"
                ? t.red
                : undefined;

  const merged: StyleProp<TextStyle> = [
    {
      fontSize: spec.size,
      fontWeight: weight ?? spec.weight,
      letterSpacing: spec.letterSpacing,
      lineHeight: spec.lineHeight,
      color,
      textAlign: align,
      textTransform: uppercase ? "uppercase" : undefined,
      fontVariant: tabular
        ? (["tabular-nums"] as TextStyle["fontVariant"])
        : undefined,
    },
    style,
  ];

  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      allowFontScaling
      style={merged}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function fontScale(): number {
  return PixelRatio.getFontScale();
}

export const TextStyles = StyleSheet.create({});
