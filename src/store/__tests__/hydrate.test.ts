// Hydrate edge case tests. Each test re-imports both AsyncStorage and store
// after jest.resetModules() so that module-level state (Map in stub, state
// singleton in store) is fresh per test.

const STORAGE_KEY = "ggai:state:v1";

beforeEach(() => {
  jest.resetModules();
});

async function freshAsyncStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-async-storage/async-storage").default as {
    setItem: (k: string, v: string) => Promise<void>;
    getItem: (k: string) => Promise<string | null>;
  };
}

async function freshStore() {
  return import("../store");
}

describe("hydrate", () => {
  test("clean slate: no AsyncStorage data → fresh state, no failure flag", async () => {
    const { hydrate, Store, didHydrationFail } = await freshStore();
    await hydrate();
    expect(didHydrationFail()).toBe(false);
    expect(Store.state.transactions).toEqual([]);
  });

  test("valid stored state hydrates correctly", async () => {
    const AS = await freshAsyncStorage();
    await AS.setItem(
      STORAGE_KEY,
      JSON.stringify({
        __v: 4,
        transactions: [
          {
            id: "tx1",
            type: "expense",
            category: "Market",
            amount: 100,
            date: "2026-04-15",
          },
        ],
        pending: [],
        recurring: [],
        goals: [],
        assets: [],
        debts: [],
        templates: [],
        categories: { income: [], expense: [] },
        settings: {},
      }),
    );
    const { hydrate, Store, didHydrationFail } = await freshStore();
    await hydrate();
    expect(didHydrationFail()).toBe(false);
    expect(Store.state.transactions).toHaveLength(1);
    expect(Store.state.transactions[0].id).toBe("tx1");
  });

  test("corrupt JSON sets hydrationFailed flag, state stays fresh", async () => {
    const AS = await freshAsyncStorage();
    await AS.setItem(STORAGE_KEY, "{ this is not valid json");
    const { hydrate, Store, didHydrationFail } = await freshStore();
    await hydrate();
    expect(didHydrationFail()).toBe(true);
    expect(Store.state.transactions).toEqual([]);
  });

  test("legacy unversioned shape is migrated forward", async () => {
    const AS = await freshAsyncStorage();
    await AS.setItem(
      STORAGE_KEY,
      JSON.stringify({
        transactions: [],
        pending: [],
        silver: [{ id: "s1", kind: "gram", amount: 200, buyPrice: 40 }],
        recurring: [],
        goals: [],
        categories: { income: [], expense: [] },
        settings: { silverGramPrice: 50 },
      }),
    );
    const { hydrate, Store, didHydrationFail } = await freshStore();
    await hydrate();
    expect(didHydrationFail()).toBe(false);
    expect(Store.state.assets).toHaveLength(1);
    expect(Store.state.assets[0].kind).toBe("silver");
    expect(Store.state.assets[0].amount).toBe(200);
  });

  test("corrupt data is NOT overwritten (preserves recovery option)", async () => {
    const AS = await freshAsyncStorage();
    const corrupt = "{ corrupt";
    await AS.setItem(STORAGE_KEY, corrupt);
    const { hydrate, didHydrationFail } = await freshStore();
    await hydrate();
    expect(didHydrationFail()).toBe(true);
    const after = await AS.getItem(STORAGE_KEY);
    expect(after).toBe(corrupt);
  });
});
