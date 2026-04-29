import {
  KEEP_LAST,
  MIN_INTERVAL_MS,
  pruneTargets,
  shouldBackup,
} from "../autoBackup";

describe("shouldBackup", () => {
  test("no-data path: empty transactions skips", () => {
    const r = shouldBackup({ txCount: 0, lastAt: 0, now: Date.now() });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("no-data");
  });

  test("too-soon path: under 7 days since last backup skips", () => {
    const now = 1_700_000_000_000;
    const r = shouldBackup({
      txCount: 5,
      lastAt: now - MIN_INTERVAL_MS / 2,
      now,
    });
    expect(r.write).toBe(false);
    expect(r.reason).toBe("too-soon");
  });

  test("first-time write when lastAt=0", () => {
    const r = shouldBackup({ txCount: 1, lastAt: 0, now: Date.now() });
    expect(r.write).toBe(true);
  });

  test("8 days later writes again", () => {
    const now = 1_700_000_000_000;
    const r = shouldBackup({
      txCount: 100,
      lastAt: now - 8 * 24 * 60 * 60 * 1000,
      now,
    });
    expect(r.write).toBe(true);
  });
});

describe("pruneTargets", () => {
  test("under-the-limit list returns nothing", () => {
    expect(pruneTargets(["a", "b", "c"])).toEqual([]);
  });

  test("at-the-limit list returns nothing", () => {
    expect(pruneTargets(["a", "b", "c", "d"])).toEqual([]);
  });

  test("over-the-limit returns oldest entries", () => {
    const list = [
      "backup-2026-01-01.json",
      "backup-2026-01-08.json",
      "backup-2026-01-15.json",
      "backup-2026-01-22.json",
      "backup-2026-01-29.json", // 5th, exceeds KEEP_LAST=4
    ];
    expect(pruneTargets(list)).toEqual(["backup-2026-01-01.json"]);
  });

  test("custom keep value", () => {
    expect(pruneTargets(["a", "b", "c"], 1)).toEqual(["a", "b"]);
  });

  test("KEEP_LAST default is 4", () => {
    expect(KEEP_LAST).toBe(4);
  });
});
