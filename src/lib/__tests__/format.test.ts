import {
  currentMonthKey,
  fmtDate,
  fmtMonthLabel,
  fmtNum,
  fmtPct,
  fmtSigned,
  fmtTRY,
  inputAmount,
  maskMoney,
  monthKeyOf,
  nextMonthKey,
  normalizeTags,
  parseAmount,
  parseAmountQuery,
  prevMonthKey,
  shiftMonthKey,
  uid,
} from "../format";

describe("fmtTRY", () => {
  test("rounds and adds TR thousands separator", () => {
    expect(fmtTRY(1234567)).toBe("₺1.234.567");
    expect(fmtTRY(0)).toBe("₺0");
    expect(fmtTRY(-500)).toBe("-₺500");
  });

  test("ignores fractions (rounded)", () => {
    expect(fmtTRY(99.6)).toBe("₺100");
    expect(fmtTRY(99.4)).toBe("₺99");
  });

  test("non-finite input → ₺0", () => {
    expect(fmtTRY(NaN)).toBe("₺0");
  });
});

describe("fmtSigned", () => {
  test("plus/minus prefixes per sign", () => {
    expect(fmtSigned(100)).toBe("+₺100");
    expect(fmtSigned(-100)).toBe("−₺100"); // unicode minus
    expect(fmtSigned(0)).toBe("₺0");
  });
});

describe("fmtNum", () => {
  test("locale-aware thousands", () => {
    expect(fmtNum(1234567)).toBe("1.234.567");
  });
  test("non-finite → 0", () => {
    expect(fmtNum(NaN)).toBe("0");
  });
});

describe("fmtPct", () => {
  test("default 1 digit, leading + on non-negative", () => {
    expect(fmtPct(12.345)).toBe("+12.3%");
    expect(fmtPct(-3.14)).toBe("-3.1%");
    expect(fmtPct(0)).toBe("+0.0%");
  });
});

describe("fmtDate / fmtMonthLabel", () => {
  test("ISO yyyy-mm-dd → gg.aa.yyyy", () => {
    expect(fmtDate("2026-04-27")).toBe("27.04.2026");
    expect(fmtDate(null)).toBe("");
  });
  test("month label uses TR month names", () => {
    expect(fmtMonthLabel("2026-04")).toBe("Nisan 2026");
    expect(fmtMonthLabel("2026-12")).toBe("Aralık 2026");
  });
});

describe("monthKeyOf / currentMonthKey", () => {
  test("monthKeyOf slices to YYYY-MM", () => {
    expect(monthKeyOf("2026-04-27")).toBe("2026-04");
  });
  test("currentMonthKey matches today's calendar month", () => {
    const expected = `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, "0")}`;
    expect(currentMonthKey()).toBe(expected);
  });
});

describe("parseAmount / inputAmount", () => {
  test("Turkish-formatted '1.234,56' parses to 1234.56", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });
  test("plain decimal '99.5' parses", () => {
    // TR removes dots first → "995"
    expect(parseAmount("99.5")).toBe(995);
  });
  test("comma decimal '99,5' parses to 99.5", () => {
    expect(parseAmount("99,5")).toBe(99.5);
  });
  test("garbage returns 0", () => {
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount(null)).toBe(0);
  });
  test("inputAmount uses comma separator", () => {
    expect(inputAmount(99.5)).toBe("99,5");
    expect(inputAmount(0)).toBe("");
    expect(inputAmount(null)).toBe("");
  });
});

describe("uid", () => {
  test("generates unique identifiers", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe("normalizeTags", () => {
  test("trims whitespace and drops empties", () => {
    expect(normalizeTags("  iş ,  ,seyahat  ")).toEqual(["iş", "seyahat"]);
  });

  test("dedups case-insensitively, keeps first casing", () => {
    // TR: İ→i, ş→ş — so "İş", "iş", "İŞ" all collide on key "iş".
    // ("IŞ" lowercases to "ış" with dotless ı in tr-TR locale, distinct.)
    expect(normalizeTags("İş, iş, İŞ")).toEqual(["İş"]);
  });

  test("accepts string array directly", () => {
    expect(normalizeTags(["a", " b ", "B", ""])).toEqual(["a", "b"]);
  });

  test("Turkish locale-aware lowercase (İ→i, I→ı)", () => {
    // "İş" lowercases to "iş" in tr-TR, dedup with "iş"
    expect(normalizeTags(["İş", "iş"])).toHaveLength(1);
  });

  test("empty input returns []", () => {
    expect(normalizeTags("")).toEqual([]);
    expect(normalizeTags([])).toEqual([]);
  });
});

describe("parseAmountQuery", () => {
  test("plain number → null (text search)", () => {
    expect(parseAmountQuery("200")).toBeNull();
    expect(parseAmountQuery("Migros")).toBeNull();
  });

  test("range A-B", () => {
    expect(parseAmountQuery("200-500")).toEqual({
      kind: "range",
      min: 200,
      max: 500,
    });
    expect(parseAmountQuery("100 - 1000")).toEqual({
      kind: "range",
      min: 100,
      max: 1000,
    });
  });

  test("range with TR comma decimals", () => {
    expect(parseAmountQuery("99,5-200,75")).toEqual({
      kind: "range",
      min: 99.5,
      max: 200.75,
    });
  });

  test("greater-than", () => {
    expect(parseAmountQuery(">100")).toEqual({ kind: "gt", value: 100 });
    expect(parseAmountQuery("> 50,5")).toEqual({ kind: "gt", value: 50.5 });
  });

  test("less-than", () => {
    expect(parseAmountQuery("<50")).toEqual({ kind: "lt", value: 50 });
  });

  test("empty string → null", () => {
    expect(parseAmountQuery("")).toBeNull();
    expect(parseAmountQuery("   ")).toBeNull();
  });

  test("garbage with operator returns null", () => {
    expect(parseAmountQuery(">abc")).toBeNull();
    expect(parseAmountQuery("100-")).toBeNull();
    expect(parseAmountQuery("-100")).toBeNull();
  });

  test("text with embedded dash isn't a range", () => {
    expect(parseAmountQuery("a-b")).toBeNull();
    expect(parseAmountQuery("Migros-Şok")).toBeNull();
  });
});

describe("shiftMonthKey / prevMonthKey / nextMonthKey", () => {
  test("forward 1 month", () => {
    expect(shiftMonthKey("2026-04", 1)).toBe("2026-05");
    expect(nextMonthKey("2026-04")).toBe("2026-05");
  });
  test("backward 1 month", () => {
    expect(shiftMonthKey("2026-04", -1)).toBe("2026-03");
    expect(prevMonthKey("2026-04")).toBe("2026-03");
  });
  test("year boundary forward (Dec → Jan)", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
  });
  test("year boundary backward (Jan → Dec)", () => {
    expect(prevMonthKey("2026-01")).toBe("2025-12");
  });
  test("multi-year shift", () => {
    expect(shiftMonthKey("2026-06", 18)).toBe("2027-12");
    expect(shiftMonthKey("2026-06", -18)).toBe("2024-12");
  });
  test("zero delta is identity", () => {
    expect(shiftMonthKey("2026-06", 0)).toBe("2026-06");
  });
});

describe("maskMoney (privacy mode)", () => {
  test("passthrough when hide is false/undefined", () => {
    expect(maskMoney("₺1.234", false)).toBe("₺1.234");
    expect(maskMoney("₺1.234", undefined)).toBe("₺1.234");
  });

  test("masks digits and thousands/decimal separators", () => {
    expect(maskMoney("₺1.234", true)).toBe("₺•••••");
    expect(maskMoney("₺1.234,56", true)).toBe("₺••••••••");
  });

  test("preserves currency symbol and sign characters", () => {
    expect(maskMoney("+₺100", true)).toBe("+₺•••");
    expect(maskMoney("−₺500", true)).toBe("−₺•••");
    expect(maskMoney("-₺50", true)).toBe("-₺••");
  });

  test("masks a money string with all parts", () => {
    expect(maskMoney("+₺1.234.567", true)).toBe("+₺•••••••••");
  });

  test("empty string stays empty", () => {
    expect(maskMoney("", true)).toBe("");
  });
});
