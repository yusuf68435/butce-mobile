import { parseTRNumber, pickPrice, pickTcmbRate } from "../prices";

describe("parseTRNumber", () => {
  test("Turkish-formatted number", () => {
    expect(parseTRNumber("1.234,56")).toBe(1234.56);
  });
  test("plain number", () => {
    expect(parseTRNumber(42)).toBe(42);
  });
  test("garbage returns 0", () => {
    expect(parseTRNumber("abc")).toBe(0);
    expect(parseTRNumber(null)).toBe(0);
    expect(parseTRNumber(undefined)).toBe(0);
  });
  test("trailing currency symbol stripped", () => {
    expect(parseTRNumber("38,52 TL")).toBe(38.52);
  });
});

describe("pickPrice (truncgil-shaped JSON)", () => {
  test("nested Selling preferred", () => {
    const data = {
      USD: { Buying: "38,10", Selling: "38,52" },
    };
    expect(pickPrice(data, ["USD"])).toBe(38.52);
  });

  test("falls back to Buying when Selling missing", () => {
    const data = { USD: { Buying: "38,10" } };
    expect(pickPrice(data, ["USD"])).toBe(38.1);
  });

  test("scalar value works (gram-altin: '4523,00')", () => {
    const data = { "gram-altin": "4523,00" };
    expect(pickPrice(data, ["gram-altin"])).toBe(4523);
  });

  test("first-found key wins", () => {
    const data = { eur: 0, EUR: { Selling: "42,10" } };
    expect(pickPrice(data, ["EUR", "eur"])).toBe(42.1);
  });

  test("returns 0 when no key matches", () => {
    expect(pickPrice({ foo: "1" }, ["BAR"])).toBe(0);
  });

  test("safe on non-object input", () => {
    expect(pickPrice(null, ["USD"])).toBe(0);
    expect(pickPrice("string", ["USD"])).toBe(0);
  });
});

describe("pickTcmbRate (XML parser)", () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Tarih_Date Tarih="04.04.2026">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <Isim>ABD DOLARI</Isim>
    <ForexBuying>38.0125</ForexBuying>
    <ForexSelling>38.0850</ForexSelling>
    <BanknoteBuying>37.9858</BanknoteBuying>
    <BanknoteSelling>38.1422</BanknoteSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="EUR" CurrencyCode="EUR">
    <Unit>1</Unit>
    <Isim>EURO</Isim>
    <ForexBuying>41.5230</ForexBuying>
    <ForexSelling>41.5970</ForexSelling>
  </Currency>
</Tarih_Date>`;

  test("extracts ForexSelling for USD", () => {
    expect(pickTcmbRate(sampleXml, "USD")).toBeCloseTo(38.085, 3);
  });

  test("extracts EUR", () => {
    expect(pickTcmbRate(sampleXml, "EUR")).toBeCloseTo(41.597, 3);
  });

  test("missing currency returns 0", () => {
    expect(pickTcmbRate(sampleXml, "GBP")).toBe(0);
  });

  test("falls back to BanknoteSelling when ForexSelling absent", () => {
    const xml = `<Currency Kod="USD"><BanknoteSelling>40.50</BanknoteSelling></Currency>`;
    expect(pickTcmbRate(xml, "USD")).toBeCloseTo(40.5, 2);
  });

  test("malformed XML returns 0", () => {
    expect(pickTcmbRate("not xml at all", "USD")).toBe(0);
    expect(pickTcmbRate('<Currency Kod="USD"></Currency>', "USD")).toBe(0);
  });
});
