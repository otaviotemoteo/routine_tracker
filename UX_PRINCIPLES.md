# UX Principles — Personal Tracker

The rules this interface is built on. They aren't generic advice: each one came
from building or testing *this* app, and each names the concrete place it
applies. Read this before adding a screen, a form, or a state — it's meant to
settle decisions that were already made, not re-open them.

`ARCHITECTURE.md` says how the system is wired. This says how it should behave.

---

## The spine

1. **A screen either reports or edits — not both.** Mixing them is what made
   the first Today screen feel like an unfinished form.
2. **Never show a control that can't do anything, or a number derived from
   data the user hasn't finished giving you.**
3. **Every state has a name in text.** Colour and shape reinforce it; they
   never carry it alone.
4. **The daily check-in must stay under two minutes.** Defaults, skips, and
   prefilled answers exist to protect that. A slightly shallower answer logged
   every day beats a perfect one abandoned in week three.

---

## Status vs. editing

- **Today is a status board.** Each card reports where a habit stands — done
  (with what it logged: "2/2", "+23 p", "7.5 h") or what today expects of it
  ("Chest + triceps", "Dune · page 100 of 412", "Target 23:00 – 06:30",
  "Rest day", "Not set up"). See `src/lib/card-status.ts`.
- **One call to action per reporting screen.** Today has exactly one:
  "Complete daily". Cards carry no controls at all — which is also why the
  whole screen is server-rendered with no client JS.
- **Editing lives behind an explicit entry point** — the guided flow (`/day`)
  or a config section (`/config?section=…`).

## State, and how it looks

- **Pending must not look interactive.** A dashed outline reads as an empty
  input, i.e. tappable. The pending marker is a filled straw chip with a clock,
  the same size and border weight as the green check chip, so the two read as a
  matched pair of *state badges* (`src/components/HabitCard.tsx`).
- **Palette semantics** (Canteiro; tokens in `tailwind.config.ts`):
  - `clover` — done, positive, primary action
  - `straw` — streaks, and anything **pending or needing attention**
  - `mint` — a completed/settled surface (done cards, collapsed rows, notes)
  - `sand` — empty track (unfilled progress, skeletons)
  - `forest` — ink, borders, hard shadows
- **State is always in text too.** Cards carry an `sr-only` "Done"/"Not logged
  yet"; the week grid's cells label themselves per day. Never rely on the fill
  colour alone.
- **Signature styling is structural, not decorative:** hard offset shadows
  (`4px 4px 0`, never blurred), 2px borders, small-caps serif display type.

## Feedback

- **Every async action reports itself.** Save buttons show a spinner and
  "Saving…" while in flight (`OnboardingFooter`'s `SubmitButton` via
  `useFormStatus`, and the daily step's own pending state).
- **Failures are announced, not just coloured.** Errors render in a
  `role="alert"` region with a sentence saying what to do next ("Couldn't save.
  Check your connection and try again.") — never a red border on its own.
- **Optimistic changes must be able to roll back.** Where a write happens
  outside a form, flip the UI immediately, revert on failure, and say so.
- **Fresh data after out-of-band writes.** A `fetch` the router doesn't know
  about leaves the destination rendering from cache — call `router.refresh()`
  after it, or the user reaches a stale screen and reaches for F5
  (`src/components/daily/DailyStep.tsx`).

## Forms and data entry

- **Guided steps beat one long form.** Both the onboarding wizard and the daily
  check-in are one topic per step, with a progress bar, Back, and Skip. They
  deliberately share mechanics (`src/lib/onboarding.ts`, `src/lib/daily.ts`)
  so the app only teaches one interaction.
- **Every step saves on advance.** Abandoning midway loses nothing.
- **Everything is skippable.** A skipped area falls back to plain
  done/not-done until it's configured.
- **Prefill from what you already know.** The daily flow opens with the user's
  planned focus, current book and page, sleep target, routine blocks.
- **Collapse what's finished.** Filled rows (training days, books, routine
  blocks) fold into a mint summary card — "Mon · Chest + triceps / 2
  exercises / Edit" — so a long list stays short while you build the next one
  (`src/components/onboarding/CollapsedCard.tsx`).
- **Smart defaults over repeated typing.** A new training day advances to the
  next weekday; a new routine block starts where the previous one ended; time
  inputs carry `min` so a block can't start before the last one finished or end
  before it starts.
- **Measure a thing the way that thing is measured.** Not every exercise is
  sets×reps — a run is distance (and maybe time), a plank is sets × a hold in
  seconds. Offer the unit, don't force one (`ExerciseKind`).
- **Related fields sit together.** "Reading now" and its current-page input
  share a line; a placeholder doubles as the label when the pairing already
  explains it.
- **Don't offer what can't apply — offer the way forward instead.** At the
  reading goal, "Add book" disappears and is replaced by *"That's your whole
  goal. Want to read more than 6?"*, a link that scrolls to and focuses the
  goal field.
- **Say what's still missing.** "1 book still to add", "2 of 6 books added".

## Protecting work in progress

- **Save is disabled until something changes** — but only where saving is the
  point (config edits). In the wizard, clicking through defaults is normal, so
  Continue always works (`requireDirtyToSave`).
- **Leaving dirty asks first.** Back/Skip route through a nav guard: clean →
  navigate immediately; dirty → an "Unsaved changes" dialog offering *Keep
  editing* (the safe default, focused first) and *Discard and go back*.
- **Dirtiness is measured, not guessed** — a JSON snapshot taken once on mount,
  compared to current state.

## Navigation

- **Return where you came from.** An edit opened from Overview returns to
  Overview on both Back and Save; one opened from the config list returns
  there (`?from=overview`). The change should be visible where it was made.
- **Don't make the user scroll to leave.** A config section opens with a
  "← Reading" link at the top.
- **Client transitions only.** The nav bar lives in the `(app)` layout so it
  persists across navigations; everything uses `<Link>`. A full reload is a bug.
- **URL carries view state** so a view is linkable and survives refresh:
  `?view=week|month`, `?period=`, `?step=`, `?section=`.
- **Loading states mirror the layout** they replace, so nothing shifts when
  content lands.

## Progressive disclosure

- **Never a wall of inputs.** Two to four per step.
- **Reveal on relevance:** the current-page field appears only on the book
  you're reading; the training picker only when you say you trained something
  else; the struggle note only after you name a hard block.
- **Explain derived numbers on demand.** The reading pace shows an ⓘ that
  opens a dialog with the actual math, rather than expanding the page for
  everyone.
- **Group to create hierarchy.** Repeated control rows (per-language steppers)
  get their own cards; without containment they read as one undifferentiated
  list.

## Copy

- **Bilingual, English default**, switchable from every screen — including the
  ones without the nav bar (`/onboarding`, `/config`).
- **All copy lives in `src/lib/i18n.ts`**, and must stay **serializable**:
  strings with `{placeholders}` resolved by `format()`, plural forms picked by
  `plural()`. Never functions — they can't cross the Server→Client boundary.
- **Respect plurals.** "1 blocos hoje" is a bug.
- **Sentence case, direct verbs, second person.** Say what to do, not what
  went wrong in the abstract.
- **User content is never translated** (book titles, exercise names); labels
  always are.
- **No emoji anywhere in the UI.** Habit icons are lucide SVGs mapped by slug
  (`src/lib/icons.ts`); the emoji in the seed data is legacy and never rendered.

## Accessibility

- **Touch targets ≥ 44×44px**, with ≥ 8px between adjacent ones. When a visual
  element is smaller (a 30px chip), the hit area still isn't.
- **Visible focus everywhere** — a 3px straw ring, never removed.
- **Semantics before ARIA:** real `<button>`/`<a>`, `<dialog>` for modals
  (focus trap and Escape for free), `role="progressbar"` with values,
  `aria-pressed` on toggles, `aria-current="page"` in the nav.
- **No nested interactive elements.** Where a card and a control overlap, the
  card is an absolute link *under* a stacked button.
- **`prefers-reduced-motion` is respected** globally, and animations that
  convey progress degrade to their end state.

## Mobile-first

- Primary use is the phone; design at **360–390px** and let desktop have the
  extra room.
- **The page never scrolls horizontally.** Wide content (the week grid) scrolls
  inside its own container.
- **Fit one line at 360px** rather than wrapping controls: narrow the inputs
  (`min-w-0 flex-1`), shorten the labels (single-letter weekday headers), keep
  remove buttons `shrink-0`.
- Sheets/dialogs are bottom-sheet on mobile, centred on desktop.

## Correctness the user can feel

- **The day is always the São Paulo day.** Never `new Date()` for "today",
  never a database default — a check saved at 22:00 must not land on tomorrow
  (`todayInSaoPaulo()`).
- **Rules that don't punish:** a streak counts from yesterday (an unchecked
  today never zeroes it); monthly adherence divides by *elapsed* days, not the
  whole month; optional habits count nowhere.
- **Show a target only when it's real.** While the book list is incomplete,
  show what's missing instead of a pace computed from books that don't exist
  yet.

---

## Checklist for a new screen

- [ ] Is this screen reporting or editing? (If both, split it.)
- [ ] Does every state have a text label, not just a colour?
- [ ] Do pending/empty states look inert rather than tappable?
- [ ] Does every async action show progress and announce failure?
- [ ] Are all touch targets ≥ 44px with visible focus?
- [ ] Does it hold together at 360px with no horizontal scroll?
- [ ] Is every string in `i18n.ts`, in both languages, serializable, pluralized?
- [ ] Are dates computed via `todayInSaoPaulo()` and friends?
- [ ] Can unsaved work be lost by a mis-tap? (Guard it.)
- [ ] After a write, will the next screen show fresh data?
- [ ] Empty state: does it say what to do and link there?
