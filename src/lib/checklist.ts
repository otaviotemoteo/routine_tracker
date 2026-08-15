// Parsing for the Checklist card style's item list — used by the chooser's
// inline item-naming form and validated again server-side in
// src/app/(app)/habits/templates/actions.ts.
const MAX_CHECKLIST_ITEMS = 8;
const MAX_ITEM_LENGTH = 80;

// One item per line: trimmed, empties dropped, duplicates dropped, capped so
// a pasted paragraph can't blow the card's panel out.
export function parseChecklistItems(raw: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim().slice(0, MAX_ITEM_LENGTH);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    items.push(trimmed);
    if (items.length >= MAX_CHECKLIST_ITEMS) break;
  }
  return items;
}
