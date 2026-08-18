# Security review

Written before `sofia` and `caca` signed in, because the remodel that made
`habits` per-user is the change that turns this from a single-user app into a
multi-user one. Until now a missed scope leaked nothing — there was only one
account. From now on it leaks somebody's sealed values assessment, which is the
most intimate record this app holds.

**The adversary being modelled is a signed-in friend.** Not an anonymous
attacker on the internet: accounts are created by script only, there is no
sign-up page, and the set of people with a session is small and known. The
realistic attack is somebody with a valid cookie editing an id in a URL — out
of curiosity as much as malice. That is what most of what follows is about.

Everything below was checked against the code at the time of writing. Where a
check is deferred to a running system, it says so and points at the checklist
in `BLOCKED.md`.

---

## 1. What the compiler guarantees, and what it does not

`src/db/scope.ts` defines `UserId` as a branded number. Only `src/lib/session.ts`
mints one, out of a cookie whose signature this process verified. A raw integer
off a route param or a request body no longer typechecks as a user id.

**Verified:** the only `as UserId` casts in the entire tree are the two inside
`asUserId()` and `scriptUserId()` in `scope.ts` itself. There is no third
place where an unauthenticated integer is asserted to be a user.

| Module | Enforcement | Why |
|---|---|---|
| `queries.ts` | branded | every export takes `userId` first; the compiler found every call site |
| `habits.ts` | branded | newest and least-reviewed surface |
| `assessment.ts` | branded | the most intimate record; the retrofit cost one annotation |
| `ai.ts` | branded | `ai_runs.output` carries text derived from someone's directions |
| `login-attempts.ts` | **none, by nature** | pre-auth: there is no user yet |
| `users.ts` | **none, by nature** | `findUserByName` runs *before* a session exists; `claimAccount` / `changePassword` take an id that is pre-session or script-only |
| `migrate-*.ts`, `seed*.ts` | **none, by nature** | `pg` over TCP, no session, operator-run |

The bottom three are not an oversight and must not be "fixed". Branding a value
that was never authenticated would be a lie about where it came from, and the
brand is only worth having while it means one thing.

**The honest limit of the guarantee:** the brand proves the right *type*
reached a query. It cannot prove the query *used* it. That gap is covered
behaviourally instead, by `src/db/isolation.test.ts` (§4).

**A second limit, found and closed this phase (3.1):** the brand also used to
prove less than it looked like it did — `asUserId()`'s input was "a signature
this process verified," never "a row that still exists." The auth cookie is
valid for a year regardless of what happens to the account; a stale browser
session surviving an account cleanup would keep minting a UserId every
downstream write assumed was real, until the first foreign-key constraint it
touched threw (`cycles_user_id_fkey`, in production, from `/onboarding`).
`requireUserId()`/`getUserId()` now confirm the row exists before minting
(`src/lib/session-resolve.ts`'s `resolveSessionUserId`, tested directly
against a real database in `src/lib/session-resolve.test.ts` — a deleted
account's still-valid-signature cookie now resolves to `null`, not a crash).
The stale cookie is also cleared where Next allows a cookie write from that
call site (Server Actions, Route Handlers); a plain page render can't legally
clear it, so it's left in place there and simply re-rejected on every
subsequent request until a fresh login overwrites it.

Two unbranded `userId: number` parameters remain and both are correct:
`createAuthCookieValue` in `src/lib/auth.ts` and `startSession` in
`src/app/login/actions.ts`. Both run at the moment a session is being *created*,
which is by definition before one exists.

## 2. Scope audit

Read line by line rather than assumed.

**Every user-facing read of `habits` goes through one predicate.** All five
`from(habits)` sites in `queries.ts` (lines 91, 887, 1106, 1312, 1418) use
`habitsFor()` or `habitsForRange()`. Both include `active_from IS NOT NULL`, so
a proposed habit is invisible to Today, the day flow, the streak, the week grid,
the month view and the export **by construction** rather than by each caller
remembering.

**Four `from(habits)` sites in `habits.ts` deliberately do not use it**, and
each is correct:

- `uniqueSlug()` — slug uniqueness spans proposals too, or accepting a proposal
  could collide with a tracked habit.
- `createHabit()`'s next-position query — same reason.
- `habitIdsBySlug()` — filters `eq(habits.userId, userId)` explicitly.

All four still filter on the owner. They see more of *your own* rows, never
anyone else's.

**Id-addressed writes.** `updateHabit`, `removeHabit`, `toggleCheck`,
`saveCheckDetails` and `getCheckTemplateKind` all carry
`WHERE id = ? AND user_id = ?`. A foreign id matches no row and comes back as
`false` / `null` — never a 403, because a 403 would confirm the row exists.

**One read has no explicit user filter and is justified:** `toggleCheck` and
`saveCheckDetails` re-read the row by id after the guarded `UPDATE`. The id
returned by that `UPDATE` is already proven to belong to the caller, so
re-filtering would be theatre.

**`/api/export`** (`src/app/api/export/route.ts:12`) derives `userId` from
`getUserId()` and never from a parameter. The only inputs are `from` and `to`,
both `z.string().date()`. `getExport` scopes its `daily_checks` query on
`userId` directly; the six rich-domain entities (workout plan, reading list,
routine blocks, languages, spiritual practices, sleep target) come from each
habit's own `config`, reached through the same `getHabitByTemplateKind`
lookup every other read in `src/db/rich-habits.ts` uses — scoped by
`habits.user_id`, one level up from where `workout_plan_days`' join used to
reach it.

**All four `/api/checks/*` routes** derive the user the same way and answer 401
when there is no session.

## 3. Login

Rewritten this phase. The reasoning is in `src/lib/login-guard.ts`; the summary:

- **The counter is in Postgres** (`login_attempts`), replacing an in-memory Map
  that reset on every cold start. The old limit was, in practice, "five attempts
  per serverless instance", and instances are cheap for an attacker to get.
- **Progressive backoff before any block.** Two free attempts, then a delay that
  doubles from 400ms to a 5s cap. Automated guessing dies against it; a person
  who mistypes their own password never learns a limit exists.
- **Blocks by IP, never locks the handle.** This is the decision that matters
  most and it is the one that looks wrong at first glance. Locking an account
  after n failures hands anyone a denial-of-service against a *named user*: type
  their name, get it wrong twelve times, and they cannot sign in. This app's
  login **is** a person's name, and the set of names is small. So the handle
  counter is recorded for detection only — to answer "is someone working
  through the account list from many addresses?" — and is never consulted for
  blocking.
- **The timing oracle is closed.** The wording was already identical for an
  unknown name and a wrong password; the clock was not. `!user` short-circuited
  before `verifyPassword`, so a nonexistent handle answered without paying
  600,000 PBKDF2 iterations — measurably faster, and over a few dozen samples a
  reliable account-enumeration oracle. Both paths now verify, the miss path
  against `DUMMY_PASSWORD_HASH`. An unclaimed account takes the same branch.

**Two gaps are accepted and stated rather than fixed:**

1. **A deleted user's cookie stays valid until it expires.** The middleware
   verifies the signature without a database round trip, which is what keeps
   authorization free per request. With a closed, known set of accounts, the
   exposure is a person whose account was deleted continuing to read *their own*
   data for the remainder of the cookie's life. Fixing it means a query per
   request; not worth it at this size.
2. **`submitName` reveals an unclaimed account** by offering the claim screen.
   That is the claim flow working as designed, and it is why account names are
   not published anywhere.

## 4. The isolation test

`src/db/isolation.test.ts` — twelve assertions, run against a real Postgres.
It creates two accounts, gives each a sealed assessment, directions, habits,
proposals and checks, then acts as A against every one of B's ids.

Covered: habit list, habit-by-id (tracked *and* proposed), the day's checks,
the proposal list, the sealed assessment, directions read with B's cycle id,
the full export, editing B's habit, removing B's habit, toggling B's check,
and A pressing "Start tracking" while B has proposals outstanding.

The last group is the one worth having: it asserts the row is genuinely
**untouched** afterwards, not merely that the call reported failure.

It skips without `DATABASE_URL`, so it does not run on a machine with no
credentials. Running it is item 3 of the `BLOCKED.md` checklist.

## 5. Provider keys

- `src/lib/ai/providers.ts` is the **only** module that reads a key, and it
  carries `import "server-only"`, so importing it from a Client Component is a
  build error rather than a runtime surprise. A key that reaches a client bundle
  is a key that has been published.
- `src/lib/ai/harness.ts` writes `ai_runs.error` through `scrubError()`, which
  strips anything shaped like a key (`sk…`, `gsk…`, `AIza…`, `Bearer …`) and
  truncates to 300 characters. Provider SDKs do sometimes put the whole request,
  headers included, into an error message.
- **The prompt is never logged.** It contains someone's directions, which is the
  most personal text in the app. `ai_runs` stores a hash of the input, not the
  input.
- `.env.example` carries the three names, blank.

## 6. Prompt injection — the genuinely new surface

The direction narrative is user-written free text that reaches a model. It is
the first place in this app where somebody's typing becomes part of an
instruction, so it deserves naming rather than assuming.

**Why the exposure is small here, stated honestly:**

- The output is **schema-constrained**. `generateObject` with a `.strict()` Zod
  schema means an injected instruction cannot add a field, and a response that
  does not fit the shape is recorded as `invalid` and thrown away.
- **`templateKind` is a one-member enum.** The single highest-value thing to
  inject would be a template kind that renders somebody else's data; it is not
  representable.
- **There are no numeric fields at all**, so nothing injected can move a target,
  a streak or an adherence figure. "AI never calculates" is a property of the
  type, not a request in a prompt.
- **Nothing is executed.** The output becomes text in `habits.name`,
  `minimal_action` and `why`. It is rendered as text by React, which escapes it.
- **Every field lands in a form a human reviews** before `active_from` is ever
  set. Nothing generated reaches Today without somebody pressing a button.

**What it could still do:** an injected instruction could make the model propose
a habit whose *wording* is hostile or absurd. That is a content problem, visible
on the review screen, and the user's own text is the only thing that could cause
it. Their own text about their own life is the input the feature exists to read.

## 7. Quota and cost

`ai_runs` doubles as the durable per-user daily counter (`DAILY_RUN_QUOTA`, 20
uncached calls). Unlike the login limiter it replaces, a cold start cannot reset
it — it is a count of rows.

`canGenerate()` is read *before* any I/O, so a spent quota makes the Generate
button **absent** rather than present-and-failing. The review screen generates
only when the proposed set is empty, so a refresh — the obvious way to run up a
bill by accident — costs nothing. Reaching the generator at all requires
`?generate=1`, which only the areas screen's button puts in a URL.

## 8. Assessment immutability

Re-verified after the remodel. `sealAssessment` fires only when all twelve
domains are present and `completed_at IS NULL`, and computes
`priority_domains` from the rows it reads back, never from anything the client
sent. `saveRating` carries `AND a.completed_at IS NULL` in the same statement
as the write, so a browser-back into a sealed check-in writes nothing.

`priority_domains` is **never rewritten**, including by "Include another area" —
adding an area means writing a sixth direction, and the frozen cut stays as the
record of what the engine said. See `buildingAreas()` in `src/lib/assessment.ts`.

## 9. Still to run against a live system

These need credentials, a running database, or a browser, and none of them were
attempted on the build machine. They are items 6–17 of `BLOCKED.md`:

- Both migrations against production Neon, and the SSL posture check
  (`NEON_LOCAL_PROXY` must not be able to leak into a production config).
- The isolation suite against a real Postgres.
- Login hardening end to end: failures from one IP escalating then blocking
  *that IP*, while the same handle still signs in from a second IP — and ~20
  timed attempts against a nonexistent handle versus ~20 against a real handle
  with a wrong password, asserting the two distributions **overlap**. That is
  the timing fix, and it is the only item here that can silently regress.
- Two browser profiles, different accounts, hand-edited ids in
  `/api/checks/:id` and `/api/export`.
