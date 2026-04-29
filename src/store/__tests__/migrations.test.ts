import { CURRENT_VERSION, migrate } from "../migrations";

describe("migrate", () => {
  test("legacy unversioned state runs through every step to current", () => {
    const legacy = {
      transactions: [
        {
          id: "1",
          type: "expense",
          category: "Market",
          amount: 50,
          date: "2026-01-01",
        },
      ],
      pending: [],
      silver: [{ id: "s1", kind: "gram", amount: 100, buyPrice: 40 }],
      categories: { income: [], expense: [] },
      settings: { silverGramPrice: 45 },
    };
    const { state, changed } = migrate(legacy);
    expect(changed).toBe(true);
    expect(state.__v).toBe(CURRENT_VERSION);
    expect(state.assets).toBeDefined();
    expect(state.debts).toEqual([]);
    expect(state.templates).toEqual([]);
    // wallets dropped at v4
    expect(state.wallets).toBeUndefined();
    // silver position migrated into assets
    const assets = state.assets as Array<{ kind: string; amount: number }>;
    expect(assets.find((a) => a.kind === "silver")?.amount).toBe(100);
    // existing transactions preserved
    expect((state.transactions as unknown[]).length).toBe(1);
  });

  test("v1 state migrates to current without losing data", () => {
    const v1 = {
      __v: 1,
      transactions: [],
      pending: [],
      silver: [],
      recurring: [],
      goals: [],
      categories: { income: ["X"], expense: ["Y"] },
      settings: { onboarded: true, themeOverride: "dark", defaultTab: "cash" },
    };
    const { state, changed } = migrate(v1);
    expect(changed).toBe(true);
    expect(state.__v).toBe(CURRENT_VERSION);
    const settings = state.settings as Record<string, unknown>;
    expect(settings.onboarded).toBe(true);
    // v4 drops themeOverride + defaultTab
    expect(settings.themeOverride).toBeUndefined();
    expect(settings.defaultTab).toBeUndefined();
    expect(state.assets).toEqual([]);
    expect(state.templates).toEqual([]);
    expect(state.wallets).toBeUndefined();
  });

  test("already current version is no-op", () => {
    const current = {
      __v: CURRENT_VERSION,
      transactions: [],
      pending: [],
      recurring: [],
      goals: [],
      assets: [],
      debts: [],
      templates: [],
      categories: { income: [], expense: [] },
      settings: {},
    };
    const { state, changed } = migrate(current);
    expect(changed).toBe(false);
    expect(state).toEqual(current);
  });

  test("totally empty input yields a valid skeleton", () => {
    const { state } = migrate({});
    expect(state.__v).toBe(CURRENT_VERSION);
    expect(state.transactions).toEqual([]);
    expect(state.assets).toEqual([]);
  });

  test("non-object input safe", () => {
    const { state } = migrate(null);
    expect(state.__v).toBe(CURRENT_VERSION);
  });

  test("v4 drops stocks but preserves them in __droppedStocks", () => {
    const v3 = {
      __v: 3,
      transactions: [],
      pending: [],
      silver: [],
      recurring: [],
      goals: [],
      assets: [
        { id: "s1", name: "THYAO", kind: "stock", amount: 100, buyPrice: 50 },
        { id: "g1", name: "Altın", kind: "gold", amount: 5, buyPrice: 7000 },
      ],
      debts: [],
      wallets: [],
      templates: [],
      categories: { income: [], expense: [] },
      settings: {},
    };
    const { state } = migrate(v3);
    const assets = state.assets as Array<{ kind: string }>;
    expect(assets.every((a) => a.kind !== "stock")).toBe(true);
    expect(assets.find((a) => a.kind === "gold")).toBeDefined();
    expect(state.__droppedStocks).toBeDefined();
  });

  test("v4 migrates gram silver positions into assets with currentPrice fallback", () => {
    const v3 = {
      __v: 3,
      transactions: [],
      pending: [],
      silver: [
        {
          id: "ps1",
          kind: "gram",
          amount: 250,
          buyPrice: 38,
          currentPrice: null,
        },
      ],
      recurring: [],
      goals: [],
      assets: [],
      debts: [],
      wallets: [],
      templates: [],
      categories: { income: [], expense: [] },
      settings: { silverGramPrice: 45 },
    };
    const { state } = migrate(v3);
    const assets = state.assets as Array<{
      kind: string;
      amount: number;
      buyPrice: number;
      currentPrice: number | null;
    }>;
    const silverAsset = assets.find((a) => a.kind === "silver");
    expect(silverAsset).toBeDefined();
    expect(silverAsset?.amount).toBe(250);
    expect(silverAsset?.buyPrice).toBe(38);
    // currentPrice was null on legacy → falls back to settings.silverGramPrice
    expect(silverAsset?.currentPrice).toBe(45);
  });

  test("v4 converts ounce silver positions to gram-equivalent", () => {
    const v3 = {
      __v: 3,
      transactions: [],
      pending: [],
      silver: [
        {
          id: "po1",
          kind: "ounce",
          amount: 2, // 2 ons → ~62.207 gram
          buyPrice: 1180, // ons başına
          currentPrice: 1240,
        },
      ],
      recurring: [],
      goals: [],
      assets: [],
      debts: [],
      wallets: [],
      templates: [],
      categories: { income: [], expense: [] },
      settings: {},
    };
    const { state } = migrate(v3);
    const assets = state.assets as Array<{
      kind: string;
      amount: number;
      buyPrice: number;
      currentPrice: number | null;
      name: string;
    }>;
    const a = assets.find((x) => x.kind === "silver");
    expect(a?.name).toMatch(/ons/i);
    expect(a?.amount).toBeCloseTo(62.207, 2);
    // buyPrice converted from ons-basis to gram-basis
    expect(a?.buyPrice).toBeCloseTo(1180 / 31.1035, 2);
    expect(a?.currentPrice).toBe(1240);
  });

  test("v4 wallets array is dropped", () => {
    const v3 = {
      __v: 3,
      transactions: [],
      pending: [],
      silver: [],
      recurring: [],
      goals: [],
      assets: [],
      debts: [],
      wallets: [{ id: "w1", name: "KT", color: "#000" }],
      templates: [],
      categories: { income: [], expense: [] },
      settings: {},
    };
    const { state } = migrate(v3);
    expect(state.wallets).toBeUndefined();
  });

  test("v4 drops themeOverride and defaultTab from settings", () => {
    const v3 = {
      __v: 3,
      transactions: [],
      pending: [],
      silver: [],
      recurring: [],
      goals: [],
      assets: [],
      debts: [],
      wallets: [],
      templates: [],
      categories: { income: [], expense: [] },
      settings: {
        themeOverride: "dark",
        defaultTab: "pending",
        notifyHour: 8,
        biometricLock: true,
      },
    };
    const { state } = migrate(v3);
    const settings = state.settings as Record<string, unknown>;
    expect(settings.themeOverride).toBeUndefined();
    expect(settings.defaultTab).toBeUndefined();
    // Other settings preserved
    expect(settings.notifyHour).toBe(8);
    expect(settings.biometricLock).toBe(true);
  });
});
