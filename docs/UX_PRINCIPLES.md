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
- **Summaries are sentences, not shorthand.** "5/5", "+9p", "7h" are compact
  but need decoding. Say "All exercises done", "9 pages read", "7h slept",
  "4 of 6 blocks followed" (`src/lib/summaries.ts`).
- **Signature styling is structural, not decorative:** hard offset shadows
  (`4px 4px 0`, never blurred), 2px borders, small-caps serif display type.

## Hierarchy inside a card

- **One number is the point.** Every Today card has the same anatomy — status
  pill, a big mono **hero** number with its unit, a muted context line, and a
  tinted note pinned to the bottom (`src/lib/today-card.ts`,
  `src/components/HabitCard.tsx`). The eye should land on "9 · pages read
  today" before it reads anything else.
- **The hero and the context must never contradict each other.** They're
  derived from the *same* record: the workout card reads the plan day that was
  actually logged (`details.plan_day_id`), not the one scheduled for today.
- **Say each thing once per card.** If the hero already says "60 min of
  guitar", the panel doesn't repeat "Guitar"; it explains the optional rule.
- **Cards in a grid are the same height** (`grid-auto-rows: 1fr` + `h-full`),
  and **one band absorbs that height** — the tinted context panel, via
  `flex-1 min-h-0`. Pinning a note with `mt-auto` and letting the middle go
  empty is what makes a pending card look broken: on the first visit of the
  day all seven are pending, so seven holes open at once.
- **The panel's eyebrow states the mode, not the metric.** `LOGGED` /
  `PLANNED` / `TARGET` / `OPTIONAL`, chosen by state — a "BLOCKS FOLLOWED"
  label directly under a "4/6 blocks followed" hero says nothing new.
- **A pending card still has content.** It shows the plan (today's session,
  the pages that reach the target page, the sleep window) plus one comparison
  line — the streak at risk, or when you last did it. The status pill carries
  "not logged yet"; the card body doesn't need to repeat it.
- **Comparisons stay as coarse as the data.** Days are stored as São Paulo
  calendar days, so cards say "yesterday" and "3 days ago" (`relativeDay()`),
  never a clock time reconstructed from `created_at`. A streak line appears
  only from two days up.
- **A period is named once.** The Overview header carries the date range as its
  eyebrow and the prev/next arrows sit on the title itself
  (`src/components/overview/PeriodHeader.tsx`) — a separate nav row repeating
  the same label is just clutter.

## Dense views

- **A grid cell shows state; the tooltip shows the figures.** Week cells are
  clover ✓ / straw `~` / sand `—` / blank for the future; selecting a day rings
  the column and opens a dark tooltip listing every habit with its short value
  and a `See day →` link into the audit (`DayTooltip`).
- **Hover is never the only way in.** The same cells open on click/tap, take
  focus, and close on Escape (`use-day-selection.ts`) — the phone is the
  primary device.
- **"Partial" only applies where there's a plan to fall short of.** 3 of 5
  exercises is partial; one prayer out of three configured practices is not —
  the practices are a menu, not a checklist (`src/lib/cell-value.ts`).
- **A heat scale needs a legend and a real ramp.** Five steps that move in fill
  *and* darkness, labelled LESS→MORE, with each day also printing `n/6` so the
  colour never has to be decoded.

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

## Getting in

- **Ask for one thing at a time.** Sign-in is the name, then the password —
  because until we know who you are we can't know whether you even *have* a
  password yet. Two short steps beat one form that asks for something half the
  people don't have.
- **Never say which half was wrong.** "Wrong name or password" — one message
  for a bad name and a bad password alike, so the form can't be used to find
  out who has an account.
- **Rules are shown while typing, not after submitting.** A password field you
  can't read is hard enough; the three rules sit under it as a live checklist
  and the button stays disabled until they pass
  (`src/lib/password-rules.ts` is read by both the checklist and the server, so
  the form can never accept what the action rejects).
- **First access lands in onboarding, not on an empty Today.** A brand-new
  account has nothing to show; drop it where it can say what it tracks.
- **The way out is always visible.** Sign-out sits in the nav on every screen of
  the app — label on desktop, icon alone on a phone where the row is already
  three controls wide.

## Forms and data entry

- **Guided steps beat one long form.** Both the onboarding wizard and the daily
  check-in are one topic per step, with a progress bar, Back, and Skip. They
  deliberately share mechanics (`src/lib/onboarding.ts`, `src/lib/daily.ts`)
  so the app only teaches one interaction.
- **A resumed task opens as an index, not a replay.** The first daily check-in
  walks all seven steps; once anything is logged, the CTA becomes "Fill the
  remaining tasks" and opens a list of the day's areas — done ones in mint with
  their summary, pending ones in white — so the user jumps to what's left
  (`src/components/daily/DailyIndex.tsx`). Entry points should name what
  they'll actually do: "Complete daily" / "Fill the remaining tasks" /
  "Review the day".
- **Every step saves on advance.** Abandoning midway loses nothing.
- **Everything is skippable.** A skipped area falls back to plain
  done/not-done until it's configured.
- **Prefill from what you already know.** The daily flow opens with the user's
  planned focus, current book and page, sleep target, routine blocks.
- **Collapse what's finished.** Filled rows (training days, books, routine
  blocks) fold into a mint summary card — "Mon · Chest + triceps / 2
  exercises" — so a long list stays short while you build the next one. Opening
  one shows what it says; changing it takes a second, explicit tap on Edit
  (`src/components/onboarding/ListCard.tsx`), because arriving at a step you
  filled in weeks ago should let you *look* at it.
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
- **Don't make the user scroll to leave, and don't stack two ways back.** The
  back arrow lives *on the screen's title* ("← Reading"), not as a separate
  link above it (`StepTitle`).
- **Client transitions only.** The nav bar lives in the `(app)` layout so it
  persists across navigations; everything uses `<Link>`. A full reload is a bug.
- **URL carries view state** so a view is linkable and survives refresh:
  `?view=week|month`, `?period=`, `?step=`, `?section=`.
- **Loading states mirror the layout** they replace — the real card sizes, the
  real column count, the CTA — so nothing shifts when content lands. When a
  screen's shape changes, its skeleton changes with it.

## Progressive disclosure

- **Never a wall of inputs.** Two to four per step.
- **Reveal on relevance:** the current-page field appears only on the book
  you're reading; the training picker only when you say you trained something
  else; the struggle note only after you name a hard block.
- **Explain derived numbers on demand, wherever they appear.** Any reading-pace
  figure — onboarding, Today's card, Overview — carries the same ⓘ opening the
  same formula, set in large mono type with its terms spelled out
  (`src/components/PaceInfo.tsx`). One shared island, so a server-rendered card
  can still explain itself.
- **Show the numbers behind the formula, not just its shape.** `( Pa + Pp ) ÷
  Dr` teaches nothing on its own; each term is colour-coded and its legend row
  carries the user's *actual* figure, ending in a straw "today that's 5
  pages/day" line. The reader can check the arithmetic themselves.
- **A derived number sits in a straw note**, not a mint one: it's guidance to
  act on, not a completed state.
- **Group to create hierarchy.** Repeated control rows (per-language steppers)
  get their own cards; without containment they read as one undifferentiated
  list.
- **Give each kind of fact its own shape.** A read-only record isn't a stack of
  "label: value" lines — ticked items become a checklist with the plan's figure
  trailing each row, a set of small numbers becomes stat tiles, a set of things
  becomes chips, a 1–5 score becomes dots. `describeDetails()` returns typed
  blocks and the Day Audit renders each kind accordingly, so the page is
  scannable instead of uniform.
- **A status badge earns its place only when it says something.** "Configured"
  on an already-mint card is noise; only the unfinished state is called out.

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
- **Motion is short and meaningful.** Dialogs rise in over ~150ms and out over
  ~140ms so they read as opening rather than blinking into place; nothing
  animates purely for decoration.

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
  today never zeroes it); adherence divides by *elapsed* days — a habit kept
  all three days of a Wednesday week is at 100%, not 43% — and optional habits
  count nowhere.
- **Two figures side by side must not be the same figure twice.** Overview's
  month header already states adherence, so the summary cards spend their space
  on reading, sleep and the weak point instead of restating `120 of 174`.
- **Show a target only when it's real.** While the book list is incomplete,
  show what's missing instead of a pace computed from books that don't exist
  yet.

---

## Measuring the person, not the habit

The values check-in (`/assessment`) asks about a life rather than about a day,
and that inverts several rules above. Each inversion is deliberate.

- **Two quantities compared share one colour, and length carries the
  difference.** The first results chart put three variables on one track —
  action as a fill, importance as a tick, the distance as a `sand → straw`
  ramp — and a real reader could not decode any of them. It now draws both
  answers as separate bars in the *same* colour, so neither reads as the good
  one, and the gap is simply the difference in length. What stays forbidden is
  colouring the two differently, or colouring by value: a 3 in community life
  may be perfectly healthy, and a palette that says otherwise teaches people to
  produce the right number instead of the true one.
- **A number a reader cannot act on is not a summary.** "Family — 6 apart"
  failed review; `8/10` beside a filled bar did not. Derived figures earn their
  place by being legible on their own, not by being correct.
- **No streaks on self-report. Ever.** A streak on a values check-in measures
  your wish to keep the streak, and because it contaminates the series the
  damage is permanent. Habits may have streaks, since a habit is an observable
  behaviour. An opinion about your own life may not.
- **A control with no answer must look like it has no answer.** A range input
  always holds a value and always draws a thumb, so rendering one with a
  default silently answers the question. `RatingScale` carries `value: number |
  null` and says "unanswered" three ways at once: a dash instead of the number,
  a `sand` thumb, and a disabled Continue. It also treats `pointerdown` as an
  answer, because tapping the track exactly where the thumb already sits fires
  no change event.
- **Never a wall of inputs** is suspended here: six sliders share one screen.
  The rule guards against *heterogeneous* fields, and this is one repeated
  control answering six variations of one question about one subject. Splitting
  it would make 24 steps and destroy the ninety-seconds-per-area rhythm the
  method depends on.
- **Everything is skippable** is suspended too. There is no Skip, and Continue
  stays disabled until all six are answered, because a partial grid is not a
  weaker grid, it is one that cannot be compared to the next cycle. The
  check-in as a whole is still abandonable: the draft keeps whatever is in it.
- **Prefill from what you already know** is suspended hardest. Answers from an
  earlier check-in are never shown while answering. Seeing that you said 7 last
  time anchors you at 7 and the instrument becomes self-confirmatory noise. The
  comparison belongs on the results screen, after the answers are in.
- **Say why you are asking.** Every scale carries one plain line explaining what
  the answer is for. The questions come from a clinical instrument, the people
  answering them do not, and a question whose point is invisible gets a careless
  answer or no answer at all.
- **Name the resolution of your own ranking.** When the distances across the
  twelve areas are bunched, the results screen says so rather than presenting a
  confident order. A ranking over twelve self-reported numbers is not precise
  enough to pretend otherwise.
- **Never grade a person.** Copy says "this goal was not completed, which layer
  did it stall in", never "you failed", and never infers a mood from a number.
  A screen whose job is to show you a distance becomes a machine for feeling bad
  the moment it starts scoring.

## Lessons from the values review

Each of these came from watching the shipped screens fail at something.

- **A card must not change height when it gets its answer.** State goes where
  the value will go, not on a line that appears and disappears — otherwise
  answering makes the page reflow under the thumb that just answered. Fix the
  width of that slot too: a `max-width` lets the neighbouring text re-wrap, and
  the card changes height anyway.
- **Repeated facts of the same shape are a table, not a run of sentences.**
  Seven findings phrased as prose read as vague; the same seven as
  Area / Importance / Action became scannable, and the repetition started
  working for the reader instead of against them. Below `sm` the columns stack
  into labelled blocks — a three-column table at 360px is not a table.
- **Group an explanation into one titled surface.** Three loose ticks on the
  page are three things; the same three inside a card called "About the
  questions" are one thing, and the title says what they are for.
- **Internal rules are not user copy.** The check-in hides your previous
  answers to stop you anchoring on them. Saying so on screen only makes a
  reader wonder what else is being withheld. Protect the data quietly.
- **Cite the source when the content came from somewhere real.** The twelve
  domains are an ACT worksheet, so the screen links to ACT. Copy crosses into
  Client Components and cannot carry markup, so split the sentence into
  before / link / after and let the component assemble it.
- **Auto-advance is always cancellable, and its timer is never the CSS
  animation.** `prefers-reduced-motion` collapses animations to 0.01ms, so a
  redirect fired by `animationend` lands instantly on exactly the people least
  likely to want it. Run a `setTimeout`, let the fill be decoration, and let
  Escape, the backdrop or any interaction cancel both.
- **Focus mode is per screen, not per route.** The nav bar is hidden while the
  app is *asking* you something, and present once it is *reporting* — the
  results and the directions list are places you visit, not steps you are
  inside. `AssessmentShell` takes `chrome: "focus" | "nav"` so one route can be
  both, and the standalone language toggle renders only in focus mode because
  the nav bar already carries one.
- **Saving an edit returns you where you came from.** Marching a user through
  areas they already finished is the replay problem again, one screen later:
  when every direction is written, Save says "Save" and goes back to the list
  rather than "Save and continue" and advancing.
- **A screen whose only job is to say "done" is a dialog wearing a route.**
  Show it over the list the user is returning to, so finishing reads as landing
  back on their own work.
- **Shared Tailwind class strings live in a module with no `"use client"`.**
  Every export of a client module becomes a client-reference proxy; a Server
  Component that interpolates one (`` `${primaryButton} mt-4` ``) emits a class
  attribute containing a thrown error, silently, while direct assignment
  happens to survive. `src/components/ui/styles.ts` carries no directive for
  this reason.

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
- [ ] Does each card lead with one number, and do sibling cards match in height?
- [ ] Is anything hover-only also reachable by tap, focus and Escape?
