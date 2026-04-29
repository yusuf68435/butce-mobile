/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
  },
  // Don't try to transform RN modules — tests target pure logic only.
  modulePathIgnorePatterns: ["<rootDir>/node_modules/"],
  moduleNameMapper: {
    "^react-native$": "<rootDir>/test/rn-stub.js",
    "^expo-file-system/legacy$": "<rootDir>/test/expo-fs-stub.js",
    "^expo-file-system$": "<rootDir>/test/expo-fs-stub.js",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/test/async-storage-stub.js",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  globals: {
    __DEV__: true,
  },
};
