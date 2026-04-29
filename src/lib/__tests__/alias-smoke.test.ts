// Smoke test: tsconfig + jest path aliases work.
// If this file fails to import, the alias setup is broken.
import { fmtTRY } from "@/lib/format";
import { CURRENT_VERSION } from "@/store/migrations";

describe("path aliases", () => {
  test("@/lib resolves to src/lib", () => {
    expect(fmtTRY(1234)).toBe("₺1.234");
  });

  test("@/store resolves to src/store", () => {
    expect(typeof CURRENT_VERSION).toBe("number");
    expect(CURRENT_VERSION).toBeGreaterThan(0);
  });
});
