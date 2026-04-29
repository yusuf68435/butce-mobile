// Defansif biometric authentication wrapper.
// expo-local-authentication kurulu değilse no-op davranır.

type AuthModule = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (opts: {
    promptMessage: string;
    cancelLabel?: string;
    fallbackLabel?: string;
    disableDeviceFallback?: boolean;
  }) => Promise<{ success: boolean; error?: string; warning?: string }>;
  AuthenticationType?: {
    FACIAL_RECOGNITION: number;
    FINGERPRINT: number;
    IRIS: number;
  };
};

let mod: AuthModule | null = null;
let inited = false;
function load(): AuthModule | null {
  if (inited) return mod;
  inited = true;
  try {
    mod = require("expo-local-authentication");
  } catch {
    mod = null;
  }
  return mod;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  try {
    const [hw, enrolled] = await Promise.all([
      m.hasHardwareAsync(),
      m.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function biometricLabel(): Promise<string> {
  const m = load();
  if (!m) return "Kilit";
  try {
    const types = await m.supportedAuthenticationTypesAsync();
    const T = m.AuthenticationType ?? {
      FACIAL_RECOGNITION: 2,
      FINGERPRINT: 1,
      IRIS: 3,
    };
    if (types.includes(T.FACIAL_RECOGNITION)) return "Face ID";
    if (types.includes(T.FINGERPRINT)) return "Touch ID";
    return "Kilit";
  } catch {
    return "Kilit";
  }
}

export async function authenticate(
  promptMessage = "Bütçe'yi aç",
): Promise<boolean> {
  const m = load();
  if (!m) return true; // graceful degrade
  try {
    const r = await m.authenticateAsync({
      promptMessage,
      cancelLabel: "Vazgeç",
      fallbackLabel: "Parolayla aç",
    });
    return !!r.success;
  } catch {
    return false;
  }
}
