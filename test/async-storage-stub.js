// In-memory AsyncStorage stub for unit tests.
const store = new Map();

module.exports = {
  __esModule: true,
  default: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => {
      store.set(k, String(v));
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiGet: async (keys) =>
      keys.map((k) => [k, store.has(k) ? store.get(k) : null]),
    clear: async () => {
      store.clear();
    },
    __reset: () => store.clear(),
  },
};
