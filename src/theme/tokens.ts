import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark";

export interface Theme {
  mode: ThemeMode;
  bg: {
    grouped: string;
    elev: string;
    tertiary: string;
    fill: string;
  };
  label: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
  };
  separator: string;
  tint: string;
  green: string;
  red: string;
  orange: string;
  yellow: string;
  purple: string;
  indigo: string;
  pink: string;
  teal: string;
  gray: string;
  material: {
    bar: string;
    overlay: string;
  };
}

const light: Theme = {
  mode: "light",
  bg: {
    grouped: "#f2f2f7",
    elev: "#ffffff",
    tertiary: "#e5e5ea",
    fill: "rgba(120,120,128,0.12)",
  },
  label: {
    primary: "#000000",
    secondary: "rgba(60,60,67,0.6)",
    tertiary: "rgba(60,60,67,0.3)",
    quaternary: "rgba(60,60,67,0.18)",
  },
  separator: "rgba(60,60,67,0.18)",
  tint: "#007aff",
  green: "#34c759",
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#ffcc00",
  purple: "#af52de",
  indigo: "#5856d6",
  pink: "#ff2d55",
  teal: "#30b0c7",
  gray: "#8e8e93",
  material: {
    bar: "rgba(249,249,249,0.82)",
    overlay: "rgba(0,0,0,0.32)",
  },
};

const dark: Theme = {
  mode: "dark",
  bg: {
    grouped: "#000000",
    elev: "#1c1c1e",
    tertiary: "#2c2c2e",
    fill: "rgba(120,120,128,0.24)",
  },
  label: {
    primary: "#ffffff",
    secondary: "rgba(235,235,245,0.6)",
    tertiary: "rgba(235,235,245,0.3)",
    quaternary: "rgba(235,235,245,0.18)",
  },
  separator: "rgba(84,84,88,0.65)",
  tint: "#0a84ff",
  green: "#30d158",
  red: "#ff453a",
  orange: "#ff9f0a",
  yellow: "#ffd60a",
  purple: "#bf5af2",
  indigo: "#5e5ce6",
  pink: "#ff375f",
  teal: "#40cbe0",
  gray: "#8e8e93",
  material: {
    bar: "rgba(22,22,22,0.82)",
    overlay: "rgba(0,0,0,0.45)",
  },
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

export const ROW_COLORS = [
  "green",
  "red",
  "orange",
  "blue",
  "purple",
  "gray",
  "indigo",
  "teal",
  "pink",
  "yellow",
] as const;
export type RowColor = (typeof ROW_COLORS)[number];

export function rowColorHex(theme: Theme, c: RowColor): string {
  switch (c) {
    case "green":
      return theme.green;
    case "red":
      return theme.red;
    case "orange":
      return theme.orange;
    case "blue":
      return theme.tint;
    case "purple":
      return theme.purple;
    case "gray":
      return theme.gray;
    case "indigo":
      return theme.indigo;
    case "teal":
      return theme.teal;
    case "pink":
      return theme.pink;
    case "yellow":
      return theme.yellow;
  }
}
