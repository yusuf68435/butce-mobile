import { formatBytes } from "../storage";

describe("formatBytes", () => {
  test("under 1 KB shown as bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  test("KB range with 1 decimal", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1.5)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 - 1)).toMatch(/KB$/);
  });

  test("MB range", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 12.34)).toBe("12.3 MB");
  });

  test("GB range with 2 decimals", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.50 GB");
  });
});
