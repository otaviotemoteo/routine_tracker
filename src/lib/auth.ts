// Cookie signing/verification shared by the middleware (edge runtime) and the
// login server action — Web Crypto only, so it runs in both.
// Cookie value format: "<userId>.<issuedAtMs>.<hmacSha256Hex>".
//
// The signature covers the user id, so the cookie says *who* you are and the
// middleware can answer that without a database round trip on every request.

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

export async function createAuthCookieValue(
  userId: number,
  secret: string
): Promise<string> {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${await hmacHex(secret, payload)}`;
}

// Returns the signed-in user's id, or null when the cookie is missing, was
// tampered with, or is past its year.
export async function readAuthCookieValue(
  value: string | undefined,
  secret: string
): Promise<number | null> {
  if (!value || !secret) return null;
  const [userId, issuedAt, signature] = value.split(".");
  if (!userId || !issuedAt || !signature) return null;

  const expected = await hmacHex(secret, `${userId}.${issuedAt}`);
  if (!timingSafeEqualHex(signature, expected)) return null;

  const ageMs = Date.now() - Number(issuedAt);
  if (
    !Number.isFinite(ageMs) ||
    ageMs < 0 ||
    ageMs >= AUTH_MAX_AGE_SECONDS * 1000
  ) {
    return null;
  }
  const id = Number(userId);
  return Number.isInteger(id) && id > 0 ? id : null;
}
