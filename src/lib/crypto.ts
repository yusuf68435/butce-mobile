import CryptoJS from "crypto-js";

const SALT_BYTES = 16;
const IV_BYTES = 16;
const PBKDF2_ITER = 200000;
const KEY_BITS = 256;
const MAGIC = "BUTCE1";

export interface EncryptedPayload {
  magic: string;
  v: 1;
  kdf: "pbkdf2-sha256";
  iter: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
}

function randomWordArray(bytes: number): CryptoJS.lib.WordArray {
  return CryptoJS.lib.WordArray.random(bytes);
}

function deriveKey(
  password: string,
  salt: CryptoJS.lib.WordArray,
): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_BITS / 32,
    iterations: PBKDF2_ITER,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function encrypt(plaintext: string, password: string): EncryptedPayload {
  const salt = randomWordArray(SALT_BYTES);
  const iv = randomWordArray(IV_BYTES);
  const key = deriveKey(password, salt);
  const ct = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    magic: MAGIC,
    v: 1,
    kdf: "pbkdf2-sha256",
    iter: PBKDF2_ITER,
    salt: salt.toString(CryptoJS.enc.Base64),
    iv: iv.toString(CryptoJS.enc.Base64),
    ct: ct.toString(),
  };
}

export function decrypt(payload: EncryptedPayload, password: string): string {
  if (payload.magic !== MAGIC) throw new Error("Geçersiz dosya başlığı");
  if (payload.v !== 1) throw new Error("Bu sürüm desteklenmiyor");
  const salt = CryptoJS.enc.Base64.parse(payload.salt);
  const iv = CryptoJS.enc.Base64.parse(payload.iv);
  const key = deriveKey(password, salt);
  try {
    const decrypted = CryptoJS.AES.decrypt(payload.ct, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    if (!text) throw new Error("decryption-empty");
    return text;
  } catch {
    throw new Error("Parola yanlış veya dosya bozuk");
  }
}

export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.magic === MAGIC &&
    o.v === 1 &&
    typeof o.salt === "string" &&
    typeof o.iv === "string" &&
    typeof o.ct === "string"
  );
}
