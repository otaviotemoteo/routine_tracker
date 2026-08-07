# Personal Tracker

A small web app for keeping track of the things I do every day (training,
reading, sleep, my routine, languages, spiritual practice) and for seeing,
honestly, how consistent I actually am.

**In one sentence:** open it, say what you did today, and watch the week and the
month fill in.

---

## What it's for

Most habit apps ask a yes-or-no question and give you back a number. That's easy
to keep up with and tells you almost nothing three months later. *Did you read
today?* Yes. Which book? How many pages? On track to finish it this year? The
app has no idea.

This one asks the small follow-up questions while you're already there, and
keeps the answers. So at the end of the year there's a real record: not "I read
on 214 days", but which books, at what pace, and where the month went quiet.

The trade is that answering takes slightly longer than tapping a checkbox. Every
design decision in the app exists to keep that trade worth making. The daily
check-in is meant to stay under two minutes, because a slightly shallower answer
given every day beats a perfect one abandoned in week three.

## What you actually do with it

**Every day.** You open **Today** and see a card per habit, showing what you've
logged so far or what today expects of you: the session your plan has for a
Tuesday, the page your book is on, the sleep window you set. One button starts
the check-in, which walks you through one habit at a time with the answers
already filled in from your own setup. You correct what's wrong and move on.
Anything you'd rather not answer, you skip.

**Every so often.** **Overview** shows two things. The week is a grid with
habits down the side and days across the top. The month is a calendar that gets
greener the more you did. Point at any day to see what it held, or click through
for the full record of it. Underneath are the numbers worth knowing: which day
went best, which habit is slipping, whether your reading pace still reaches your
goal.

**Twice a year.** The **values check-in** asks a different question: not what
you did, but what you meant to. It walks through twelve areas of life, from
family and work to health, rest and art, and asks six short things about each
one. How much does this matter in the life you want? How much did you actually
do about it last week? Then it puts the two side by side and names the distance.

That distance is the whole point. It is easy to spend a year being consistent
about the things you already do and never notice which part of your life went
quiet. Every question says in one line why it is being asked, because the
questions come from a therapy worksheet and nobody should have to guess what
they are for. There are no right answers and no score at the end. A low answer
in an area that is not yours right now is a true answer, and the app treats it
as one.

**Once, at the start.** A short setup asks what you're actually tracking: your
training plan, the books you mean to read, the hours you're aiming for, the
blocks your day is built from, which languages, which practices. Everything the
daily check-in prefills comes from here, and you can change any of it later.

## The ideas behind it

- **A screen either reports or edits, never both.** Today tells you where you
  stand and has exactly one button. Changing something is always a deliberate
  move into a different screen. Mixing the two is what makes trackers feel like
  paperwork.
- **Never show a number the data can't support.** No reading pace until the book
  list is complete. No "12% above average" invented from three days of history.
  If it can't be said honestly, it isn't said.
- **The rules shouldn't punish you.** A streak counts from yesterday, so an
  unchecked today never zeroes it. Adherence divides by the days that have
  actually happened, not by the whole month, and never by days from before you
  started tracking.
- **Every state is written down, not just coloured.** Green and grey reinforce
  the meaning. The words carry it.
- **The phone is the real device.** It's designed at phone width first. The
  desktop just gets more room.
- **It works in English and Portuguese**, switchable from any screen.

## Who can use it

It's for a handful of people who know each other, so there's no sign-up page and
no way to register. Accounts are created from the command line. The first time
you sign in with your name you choose your password, and you land in setup.
Everyone's data is entirely their own. The only thing shared between accounts is
the list of habit names.

## Where the data goes

Nowhere. It lives in one database, it isn't sold or analysed by anyone, and it
can be exported whole at any time as a single file. That export is the point of
all the detail: at the end of a year it's a dataset worth reading, and the app
deliberately doesn't try to interpret it for you.

---

## For developers

| Document | What's in it |
|---|---|
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Run it locally, the stack, the schema, the API, the folder layout |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it's built and why: layering, accounts, data ownership |
| [`docs/UX_PRINCIPLES.md`](docs/UX_PRINCIPLES.md) | How it should behave, with the code that implements each rule |
| [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) | Every stored field, so the export is readable years from now |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | The "Canteiro" visual identity: palette, type, components |

```bash
bun install
cp .env.example .env.local   # DATABASE_URL (Neon), AUTH_SECRET
bun run db:push && bun run db:seed
bun run db:migrate:assessment    # the values layer, additive and re-runnable
bun run user:create <name>
bun run dev
```

`bun test` runs the diagnostic engine's tests. `bun run assessment:seed
answers.json` backfills a values check-in answered on paper, using
`answers.example.json` as the shape.

Built with Next.js, Drizzle and Neon, deployed on Vercel.
