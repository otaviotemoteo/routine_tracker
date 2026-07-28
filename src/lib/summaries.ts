// One-line badge for a habit card when it has saved details. Symbols (p/h/min)
// read the same in both languages, so no i18n is needed here.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function summarizeDetails(slug: string, details: unknown): string | null {
  const d = asRecord(details);
  if (!d) return null;

  switch (slug) {
    case "leitura":
      return typeof d.pages_read === "number" ? `+${d.pages_read} p` : null;
    case "sono":
      return typeof d.hours === "number" ? `${d.hours} h` : null;
    case "treino": {
      if (!Array.isArray(d.completed)) return null;
      const done = d.completed.filter(
        (e) => asRecord(e)?.done === true
      ).length;
      return `${done}/${d.completed.length}`;
    }
    case "rotina":
      return Array.isArray(d.followed_block_ids)
        ? `${d.followed_block_ids.length}`
        : null;
    case "duolingo": {
      if (!Array.isArray(d.sessions)) return null;
      const total = d.sessions.reduce<number>((sum, s) => {
        const lessons = asRecord(s)?.lessons;
        return sum + (typeof lessons === "number" ? lessons : 0);
      }, 0);
      return `${total} ✓`;
    }
    case "espiritualidade":
      return Array.isArray(d.practices) ? `${d.practices.length}` : null;
    case "hobby":
      if (typeof d.minutes === "number") return `${d.minutes} min`;
      return typeof d.activity === "string" && d.activity ? d.activity : null;
    default:
      return null;
  }
}
