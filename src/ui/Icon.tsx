import React from "react";
import { Platform } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { IconName } from "../lib/constants";

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const SF_MAP: Record<IconName, string> = {
  gear: "gearshape.fill",
  plus: "plus",
  "chevron-down": "chevron.down",
  "chevron-left": "chevron.left",
  "chevron-right": "chevron.right",
  cash: "banknote.fill",
  hourglass: "hourglass",
  diamond: "diamond.fill",
  "arrow-down": "arrow.down",
  "arrow-up": "arrow.up",
  trash: "trash",
  briefcase: "briefcase.fill",
  house: "house.fill",
  sparkles: "sparkles",
  cart: "cart.fill",
  fuel: "fuelpump.fill",
  doc: "doc.text.fill",
  fork: "fork.knife",
  building: "building.2.fill",
  heart: "heart.fill",
  dot: "circle.fill",
  wallet: "creditcard.fill",
  x: "xmark",
  check: "checkmark",
  search: "magnifyingglass",
  bell: "bell.fill",
  calendar: "calendar",
  tag: "tag.fill",
  chart: "chart.line.uptrend.xyaxis",
  refresh: "arrow.clockwise",
};

let symbolModule: typeof import("expo-symbols") | null = null;
let symbolModuleInited = false;
function loadSymbols() {
  if (symbolModuleInited) return symbolModule;
  symbolModuleInited = true;
  try {
    symbolModule = require("expo-symbols");
  } catch {
    symbolModule = null;
  }
  return symbolModule;
}

export function Icon({
  name,
  size = 22,
  color = "currentColor",
  strokeWidth,
}: Props) {
  if (Platform.OS === "ios") {
    const mod = loadSymbols();
    if (mod) {
      const SymbolView = mod.SymbolView;
      return (
        <SymbolView
          name={SF_MAP[name] as never}
          size={size}
          tintColor={color}
          weight="medium"
          resizeMode="scaleAspectFit"
          fallback={
            <SvgIcon
              name={name}
              size={size}
              color={color}
              strokeWidth={strokeWidth}
            />
          }
        />
      );
    }
  }
  return (
    <SvgIcon name={name} size={size} color={color} strokeWidth={strokeWidth} />
  );
}

function SvgIcon({
  name,
  size = 22,
  color = "currentColor",
  strokeWidth,
}: Props) {
  const s = strokeWidth ?? defaultStroke(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths(name, color, s)}
    </Svg>
  );
}

function defaultStroke(name: IconName): number {
  switch (name) {
    case "plus":
    case "arrow-down":
    case "arrow-up":
    case "x":
    case "check":
      return 2;
    case "chevron-down":
    case "chevron-left":
    case "chevron-right":
      return 2.2;
    case "trash":
      return 1.8;
    default:
      return 1.6;
  }
}

function paths(name: IconName, c: string, sw: number): React.ReactNode {
  const stroke = {
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "gear":
      return (
        <>
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            {...stroke}
          />
        </>
      );
    case "plus":
      return <Path d="M12 5v14M5 12h14" {...stroke} />;
    case "x":
      return <Path d="M6 6l12 12M18 6 6 18" {...stroke} />;
    case "check":
      return <Path d="M5 12l5 5 9-11" {...stroke} />;
    case "chevron-down":
      return <Path d="m6 9 6 6 6-6" {...stroke} />;
    case "chevron-left":
      return <Path d="m15 18-6-6 6-6" {...stroke} />;
    case "chevron-right":
      return <Path d="m9 18 6-6-6-6" {...stroke} />;
    case "cash":
      return (
        <>
          <Rect x={2} y={6} width={20} height={12} rx={2} {...stroke} />
          <Circle cx={12} cy={12} r={2.5} {...stroke} />
          <Path d="M5 9v6M19 9v6" {...stroke} />
        </>
      );
    case "hourglass":
      return (
        <Path
          d="M6 3h12M6 21h12M7 3v4a5 5 0 0 0 10 0V3M7 21v-4a5 5 0 0 1 10 0v4"
          {...stroke}
        />
      );
    case "diamond":
      return (
        <>
          <Path d="M6 3h12l4 6-10 12L2 9z" {...stroke} />
          <Path d="M2 9h20" {...stroke} />
          <Path d="M12 3 8 9l4 12 4-12-4-6Z" {...stroke} />
        </>
      );
    case "arrow-down":
      return <Path d="M12 5v14M19 12l-7 7-7-7" {...stroke} />;
    case "arrow-up":
      return <Path d="M12 19V5M5 12l7-7 7 7" {...stroke} />;
    case "trash":
      return (
        <Path
          d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
          {...stroke}
        />
      );
    case "briefcase":
      return (
        <>
          <Rect x={3} y={7} width={18} height={13} rx={2} {...stroke} />
          <Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...stroke} />
        </>
      );
    case "house":
      return (
        <>
          <Path
            d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            {...stroke}
          />
          <Path d="M9 22V12h6v10" {...stroke} />
        </>
      );
    case "sparkles":
      return (
        <Path
          d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
          {...stroke}
        />
      );
    case "cart":
      return (
        <>
          <Circle cx={9} cy={20} r={1.5} {...stroke} />
          <Circle cx={18} cy={20} r={1.5} {...stroke} />
          <Path
            d="M2 3h3l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6"
            {...stroke}
          />
        </>
      );
    case "fuel":
      return (
        <Path
          d="M3 22h12V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zM7 8h6M15 9h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9l-3-3"
          {...stroke}
        />
      );
    case "doc":
      return (
        <Path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"
          {...stroke}
        />
      );
    case "fork":
      return (
        <Path
          d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8a2 2 0 0 1-2 2M16 2c-1.5 1.5-2 4-2 6s.5 4 2 5v9"
          {...stroke}
        />
      );
    case "building":
      return (
        <>
          <Rect x={4} y={2} width={16} height={20} rx={1} {...stroke} />
          <Path d="M9 22v-5h6v5" {...stroke} />
        </>
      );
    case "heart":
      return (
        <Path
          d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3 5.5 5.5 0 0 0 12 5.5 5.5 5.5 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7z"
          {...stroke}
        />
      );
    case "dot":
      return <Circle cx={12} cy={12} r={3} fill={c} />;
    case "wallet":
      return (
        <>
          <Path
            d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            {...stroke}
          />
          <Path d="M3 9h18M16 14h2" {...stroke} />
        </>
      );
    case "search":
      return (
        <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="m21 21-4.3-4.3" {...stroke} />
        </>
      );
    case "bell":
      return (
        <Path
          d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
          {...stroke}
        />
      );
    case "calendar":
      return (
        <>
          <Rect x={3} y={4} width={18} height={18} rx={2} {...stroke} />
          <Path d="M16 2v4M8 2v4M3 10h18" {...stroke} />
        </>
      );
    case "tag":
      return (
        <>
          <Path
            d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"
            {...stroke}
          />
          <Circle cx={7.5} cy={7.5} r={1.5} {...stroke} />
        </>
      );
    case "chart":
      return <Path d="M3 3v18h18M7 14l4-4 4 4 5-5" {...stroke} />;
    case "refresh":
      return (
        <Path
          d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"
          {...stroke}
        />
      );
  }
}
