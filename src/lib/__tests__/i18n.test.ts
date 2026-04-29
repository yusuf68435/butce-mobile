import { getLocale, setLocale, t } from "../i18n";

describe("i18n (TR-only personal edition)", () => {
  test("locale is locked to tr", () => {
    expect(getLocale()).toBe("tr");
    setLocale("tr");
    expect(getLocale()).toBe("tr");
  });

  test("known keys return TR string", () => {
    expect(t("common.cancel")).toBe("Vazgeç");
    expect(t("section.wealth")).toBe("Toplam Servet");
  });

  test("unknown key returns key itself (debug fallback)", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });
});
