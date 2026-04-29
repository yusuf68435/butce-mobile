import { decrypt, encrypt, isEncryptedPayload } from "../crypto";

describe("crypto", () => {
  test("encrypt → decrypt round-trip preserves plaintext", () => {
    const plaintext = JSON.stringify({ hello: "dünya", amount: 1234.56 });
    const enc = encrypt(plaintext, "supersecret");
    expect(enc.magic).toBe("BUTCE1");
    expect(enc.v).toBe(1);
    expect(typeof enc.salt).toBe("string");
    expect(typeof enc.iv).toBe("string");
    expect(typeof enc.ct).toBe("string");
    const out = decrypt(enc, "supersecret");
    expect(out).toBe(plaintext);
  });

  test("wrong password rejects with helpful error", () => {
    const enc = encrypt("ok", "right");
    expect(() => decrypt(enc, "wrong")).toThrow(/Parola yanlış/);
  });

  test("isEncryptedPayload accepts well-formed and rejects junk", () => {
    const enc = encrypt("x", "p");
    expect(isEncryptedPayload(enc)).toBe(true);
    expect(isEncryptedPayload({ foo: "bar" })).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload("string")).toBe(false);
  });

  test("salt and IV vary across encryptions of same plaintext", () => {
    const a = encrypt("same", "pw");
    const b = encrypt("same", "pw");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    // both still decrypt
    expect(decrypt(a, "pw")).toBe("same");
    expect(decrypt(b, "pw")).toBe("same");
  });

  test("rejects payload with bad magic header", () => {
    const enc = encrypt("x", "p");
    expect(() => decrypt({ ...enc, magic: "WRONG" }, "p")).toThrow(
      /Geçersiz dosya/,
    );
  });
});
