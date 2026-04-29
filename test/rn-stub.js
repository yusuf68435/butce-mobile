// Minimal react-native stub for ts-jest unit tests of pure logic.
module.exports = {
  Platform: { OS: "ios", select: (x) => x.ios ?? x.default },
  NativeModules: {},
  PixelRatio: { getFontScale: () => 1 },
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => false,
    isReduceTransparencyEnabled: async () => false,
    isBoldTextEnabled: async () => false,
    addEventListener: () => ({ remove: () => {} }),
  },
  StyleSheet: {
    create: (s) => s,
    hairlineWidth: 1,
  },
};
