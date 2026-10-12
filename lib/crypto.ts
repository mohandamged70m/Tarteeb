/** AES-256-GCM encryption for stored AI keys (WebCrypto, no new deps). */

function appSecret(): string {
  const s = process.env.APP_SECRET ?? "";
  if (s.length < 32) throw new Error("APP_SECRET must be at least 32 characters");
  return s;
}

async function aesKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(appSecret());
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

const b64 = {
  encode(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  },
  decode(s: string): Uint8Array {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export async function encryptSecret(plain: string): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain))
  );
  const packed = new Uint8Array(12 + ct.length);
  packed.set(iv);
  packed.set(ct, 12);
  return "gcm1." + b64.encode(packed);
}

export async function decryptSecret(cipher: string): Promise<string> {
  if (!cipher.startsWith("gcm1.")) throw new Error("unknown cipher format");
  const packed = b64.decode(cipher.slice(5));
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const key = await aesKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export function keyHint(key: string): string {
  const last4 = key.replace(/\s/g, "").slice(-4);
  return "••••" + last4;
}

export function uuid(): string {
  return crypto.randomUUID();
}
