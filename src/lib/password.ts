// Password hashing with Web Crypto only — no native module, so it runs on the
// edge runtime and in Node alike, the same constraint auth.ts works under.
//
// PBKDF2-SHA256 at the OWASP-recommended 600k iterations. Stored as
// "iterations.saltHex.hashHex" so the cost can be raised later without
// invalidating anyone's existing password.

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}.${toHex(salt)}.${hash}`;
}

// Constant-time in the comparison; a malformed or empty stored hash is simply
// a failed verification, never a thrown error on the login path.
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [iterations, saltHex, hashHex] = stored.split(".");
  if (!iterations || !saltHex || !hashHex) return false;
  const rounds = Number(iterations);
  if (!Number.isFinite(rounds) || rounds <= 0) return false;

  const candidate = await derive(password, fromHex(saltHex), rounds);
  if (candidate.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

// A real hash of a password no account has, used to close a timing oracle.
//
// The login form already answers "wrong" identically for an unknown name and a
// bad password. The CLOCK did not: `!user` short-circuited before
// verifyPassword, so a nonexistent handle came back without paying 600,000
// PBKDF2 iterations and answered measurably faster than a real one. Timed over
// a few dozen attempts that is a reliable account-enumeration oracle, and it
// makes the identical wording cosmetic.
//
// Verifying against this constant when no user is found makes both paths do
// the same work. It is a fixed literal rather than something derived at
// startup so that the miss path costs exactly one derivation, the same as the
// hit path — deriving it lazily would make the first miss cost two and put the
// oracle back, inverted.
//
// It is not a secret. Knowing it proves only that no account has this password.
export const DUMMY_PASSWORD_HASH =
  "600000.ee99688834663288101160a3555e8da4.28f86936d8c86d76d1171c863ce911b7dc814c4d9761034d1b54f44b8570fc52";

// "Sofia" and "sofia" are the same account; the handle carries the uniqueness.
export function toHandle(name: string): string {
  return name.trim().toLowerCase();
}
