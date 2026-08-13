import "server-only";

import {
  clearFailures,
  countFailures,
  pruneExpiredAttempts,
  recordFailure,
  WINDOW_MINUTES,
} from "@/db/login-attempts";

// The login guard: what happens to somebody getting the password wrong.
//
// Protecting this one form is what keeps an attacker away from every per-user
// query behind it. A perfect scope audit is worth nothing if the front door
// opens, so this is not optional hardening — it is the same work as the
// ownership rules, applied one layer earlier.
//
// Three decisions, each of which could reasonably have gone the other way:
//
// 1. BACKOFF BEFORE ANY BLOCK. The first two mistakes cost nothing, then each
//    failure costs a growing delay. Credential stuffing dies against a delay
//    that doubles — a thousand guesses stop being worth attempting — while a
//    person who mistypes their own password twice never notices a limit
//    exists. A hard cliff at five, which is what this replaces, punishes the
//    honest case and merely inconveniences the automated one.
//
// 2. BLOCK BY IP, NEVER LOCK THE HANDLE. This is the one that matters most.
//    Locking an account after n failures hands anyone a denial-of-service
//    against a named user: type their name, get it wrong ten times, and they
//    cannot sign in. In an app whose login IS a person's name, with a closed
//    set of accounts, that attack costs nothing to mount. So the handle
//    counter exists only to DETECT an attack spread across many IPs — it is
//    recorded and never consulted for blocking.
//
// 3. THE COUNTER IS IN POSTGRES. See src/db/login-attempts.ts.

// Failures that cost nothing. Two fat-fingered attempts are a person.
const FREE_ATTEMPTS = 2;

// Where the delay starts and how far it goes. 400ms, 800ms, 1.6s, 3.2s, then
// capped — long enough to make automation pointless, short enough that a real
// person who has just remembered their password is not punished for it.
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 5_000;

// Sustained abuse from one address. Deliberately far above the point where the
// delays alone have already made brute force useless: by the time an attacker
// reaches this they have spent well over a minute on twelve guesses.
const BLOCK_AT = 12;

export interface GuardDecision {
  blocked: boolean;
  retryAfterMinutes: number;
  // Milliseconds to wait before answering. Applied on the failure path only.
  delayMs: number;
}

function delayFor(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const step = failures - FREE_ATTEMPTS - 1;
  return Math.min(BASE_DELAY_MS * 2 ** step, MAX_DELAY_MS);
}

// Asked before a password is checked. Only the IP can block.
export async function checkLoginGuard(ip: string): Promise<GuardDecision> {
  const state = await countFailures("ip", ip);
  return {
    blocked: state.failures >= BLOCK_AT,
    retryAfterMinutes: state.retryAfterMinutes || WINDOW_MINUTES,
    delayMs: delayFor(state.failures),
  };
}

// Count a wrong password against both keys — the IP, which blocks, and the
// handle, which is only ever read by a human asking "is someone working
// through the account names?".
export async function registerLoginFailure(
  ip: string,
  handle: string
): Promise<void> {
  await recordFailure("ip", ip);
  if (handle) await recordFailure("handle", handle);
}

// A correct password clears both counters and tidies up expired rows. Doing
// the housekeeping here rather than on the failure path keeps it off the
// latency-sensitive route and out of an attacker's control.
export async function clearLoginFailures(
  ip: string,
  handle: string
): Promise<void> {
  await clearFailures("ip", ip);
  if (handle) await clearFailures("handle", handle);
  await pruneExpiredAttempts();
}

// The backoff itself. Applied only once a password is found to be wrong, not
// before it is checked, so somebody who finally types the right one after four
// tries is let straight in rather than made to serve the accumulated sentence.
// The delay costs the attacker exactly as much either way.
export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}
