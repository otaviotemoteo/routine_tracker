// Cookie signing/verification shared by the middleware (edge runtime) and the
// login server action — Web Crypto only, so it runs in both.
// Cookie value format: "<issuedAtMs>.<hmacSha256Hex>".

export const AUTH_COOKIE = "tracker_auth";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const encoder = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createAuthCookieValue(secret: string): Promise<string> {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${await hmacHex(secret, issuedAt)}`;
}

export async function verifyAuthCookieValue(
  value: string | undefined,
  secret: string
): Promise<boolean> {
  if (!value || !secret) return false;
  const [issuedAt, signature] = value.split(".");
  if (!issuedAt || !signature) return false;
  const expected = await hmacHex(secret, issuedAt);
  if (!timingSafeEqualHex(signature, expected)) return false;
  const ageMs = Date.now() - Number(issuedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < AUTH_MAX_AGE_SECONDS * 1000;
}

// Compare secrets without leaking length/timing: HMAC both sides first.
export async function passwordsMatch(
  submitted: string,
  expected: string,
  secret: string
): Promise<boolean> {
  const [a, b] = await Promise.all([
    hmacHex(secret, submitted),
    hmacHex(secret, expected),
  ]);
  return timingSafeEqualHex(a, b);
}
