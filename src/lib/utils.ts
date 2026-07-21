// Pure date/business helpers. All "which day is it" questions in the app go
// through todayInSaoPaulo() — never raw new Date() — because the server (Neon,
// Vercel) runs in UTC and the day would roll over at 21:00 Brasília time.
//
// Dates travel through the app as "YYYY-MM-DD" strings. Internal math parses
// them at UTC noon, which keeps the calendar day stable regardless of the
// server's local timezone or DST shifts.

import { locale, type Lang } from "@/lib/i18n";

const SAO_PAULO_TZ = "America/Sao_Paulo";

// Mental test: at 2026-01-16 01:30 UTC it is 22:30 of 2026-01-15 in São Paulo.
// new Date().toISOString() would say "2026-01-16"; this returns "2026-01-15".
// (en-CA locale formats as YYYY-MM-DD.)
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Parse "YYYY-MM-DD" at UTC noon so day arithmetic never crosses a day
// boundary due to timezone or DST.
function toUTCNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Mental test: addDays("2026-02-28", 1) = "2026-03-01" (2026 is not a leap
// year); addDays("2026-01-01", -1) = "2025-12-31". Runs identically whether
// the server clock is in UTC or BRT because math happens at UTC noon.
export function addDays(dateStr: string, days: number): string {
  const d = toUTCNoon(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

// Week starts on Monday (Mon–Sun) everywhere in the app.
// Mental test: weekStartMonday("2026-07-21") — a Tuesday — returns
// "2026-07-20"; weekStartMonday("2026-07-19") — a Sunday — returns
// "2026-07-13" (the Monday before, since Sunday closes the week).
export function weekStartMonday(dateStr: string): string {
  const dow = toUTCNoon(dateStr).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return addDays(dateStr, -((dow + 6) % 7));
}

export function isMonday(dateStr: string): boolean {
  return toUTCNoon(dateStr).getUTCDay() === 1;
}

// Streak rule (README Decision 4): consecutive done-days counting backwards
// from YESTERDAY, plus one if today is already done. An unchecked today never
// breaks the streak — otherwise every streak would read zero each morning.
// Mental test: today = "2026-07-21", done = {19, 20} → streak 2;
// done = {19, 20, 21} → 3; done = {21} → 1; done = {19} → 0 (gap on the 20th).
export function calcStreak(
  doneDates: ReadonlySet<string>,
  today: string
): number {
  let streak = doneDates.has(today) ? 1 : 0;
  let day = addDays(today, -1);
  while (doneDates.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

// Mental test: daysInMonth("2026-02") = 28, daysInMonth("2024-02") = 29,
// daysInMonth("2026-07") = 31. (Day 0 of the next month = last day of this.)
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

// Formats "2026-07-21" as "Tuesday, July 21" (or pt-BR "terça-feira, 21 de
// julho"). The string is parsed at UTC noon and formatted in UTC, so the
// calendar day never shifts no matter what timezone the server or browser is in.
export function formatDayLong(dateStr: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toUTCNoon(dateStr));
}

// Formats "2026-07-21" as "Jul 21" (or pt-BR "21 de jul.") — week/month range labels.
export function formatShortDayMonth(dateStr: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(toUTCNoon(dateStr));
}

// Mental test: addMonths("2026-01", -1) = "2025-12";
// addMonths("2026-12", 1) = "2027-01".
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

// Formats "2026-07" as "July 2026" (or pt-BR "julho de 2026").
export function formatMonthLabel(month: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(toUTCNoon(`${month}-15`));
}

// Adherence rule (README Decision 5): the denominator is the days ELAPSED in
// the month (1st through today, inclusive) for the current month — past
// months use the full day count, future months count zero.
// Mental test: today = "2026-07-05", month "2026-07", 4 done → 4/5 = 80%,
// not the depressing 4/31 = 13%. Month "2026-06" uses 30 days.
export function calcMonthAdherence(
  month: string,
  today: string,
  doneCount: number
): { doneCount: number; countedDays: number; percent: number } {
  const currentMonth = today.slice(0, 7);
  let countedDays: number;
  if (month === currentMonth) {
    countedDays = Number(today.slice(8, 10));
  } else if (month > currentMonth) {
    countedDays = 0;
  } else {
    countedDays = daysInMonth(month);
  }
  const percent =
    countedDays === 0 ? 0 : Math.round((doneCount / countedDays) * 100);
  return { doneCount, countedDays, percent };
}
