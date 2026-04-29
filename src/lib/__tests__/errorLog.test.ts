import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearErrors } from "../errorLog";

// Helper to reset module state between tests.
async function reset() {
  await clearErrors();
  // Force buffer reload by clearing AsyncStorage too.
  await (AsyncStorage as unknown as { __reset?: () => void }).__reset?.();
}

beforeEach(async () => {
  jest.resetModules();
  await reset();
});

describe("errorLog", () => {
  test("logError stores entry and readErrors returns it", async () => {
    const mod = await import("../errorLog");
    await mod.logError("test", new Error("boom"));
    const list = await mod.readErrors();
    expect(list).toHaveLength(1);
    expect(list[0].source).toBe("test");
    expect(list[0].message).toBe("boom");
    expect(typeof list[0].at).toBe("string");
  });

  test("most recent entry is first (unshift order)", async () => {
    const mod = await import("../errorLog");
    await mod.logError("first", new Error("A"));
    await mod.logError("second", new Error("B"));
    const list = await mod.readErrors();
    expect(list[0].message).toBe("B");
    expect(list[1].message).toBe("A");
  });

  test("ring buffer caps at MAX_ENTRIES (25)", async () => {
    const mod = await import("../errorLog");
    for (let i = 0; i < 30; i++) {
      await mod.logError("flood", new Error(`#${i}`));
    }
    const list = await mod.readErrors();
    expect(list).toHaveLength(25);
    expect(list[0].message).toBe("#29"); // newest
    expect(list[24].message).toBe("#5"); // 5..29
  });

  test("logError accepts string and unknown values", async () => {
    const mod = await import("../errorLog");
    await mod.logError("a", "string error");
    await mod.logError("b", { not: "an error" });
    const list = await mod.readErrors();
    expect(list[1].message).toBe("string error");
    expect(list[0].message).toBe("unknown");
  });

  test("clearErrors empties the buffer", async () => {
    const mod = await import("../errorLog");
    await mod.logError("x", new Error("y"));
    expect((await mod.readErrors()).length).toBe(1);
    await mod.clearErrors();
    expect((await mod.readErrors()).length).toBe(0);
  });

  test("source label is truncated at 80 chars", async () => {
    const mod = await import("../errorLog");
    const longSource = "x".repeat(200);
    await mod.logError(longSource, "ok");
    const list = await mod.readErrors();
    expect(list[0].source.length).toBeLessThanOrEqual(80);
  });
});
