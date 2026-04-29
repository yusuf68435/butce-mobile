// Minimal expo-file-system stub for unit tests of pure helpers.
// IO operations no-op or throw — tests must use exported pure functions.
module.exports = {
  documentDirectory: "/tmp/test/",
  cacheDirectory: "/tmp/cache/",
  getInfoAsync: async () => ({ exists: false }),
  makeDirectoryAsync: async () => {},
  readAsStringAsync: async () => {
    throw new Error("not-implemented");
  },
  writeAsStringAsync: async () => {},
  deleteAsync: async () => {},
  copyAsync: async () => {},
  readDirectoryAsync: async () => [],
};
