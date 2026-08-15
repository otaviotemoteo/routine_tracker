// Template kind → lucide icon. The database stores the README's emoji in
// habits.icon, but the UI never renders emoji — every habit gets an SVG icon.
import {
  AlarmClock,
  BookOpen,
  CheckCircle2,
  Church,
  Dumbbell,
  Flame,
  Globe,
  Guitar,
  Hash,
  ListChecks,
  Moon,
  Sprout,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { domainIcon } from "./domain-icons";
import { isDomainSlug, type DomainSlug } from "./domains";
import { templateKindOf } from "./templates";

// The seven original habits, keyed by the template kind they carry (which for
// them is their old slug, so nothing about them changed) — plus the five
// card-style-chooser kinds, which get an icon naming the STYLE rather than a
// life area, since a habit that picked one keeps its own area on every other
// screen (the habit list, the week grid) and only Today's card needs to say
// "this is the checklist one" at a glance.
const ICON_BY_KIND: Record<string, LucideIcon> = {
  treino: Dumbbell,
  leitura: BookOpen,
  sono: Moon,
  rotina: AlarmClock,
  duolingo: Globe,
  espiritualidade: Church,
  hobby: Guitar,
  number: Hash,
  check: CheckCircle2,
  duration: Timer,
  checklist: ListChecks,
  streak: Flame,
};

// A habit with no template takes the icon of the life area it descends from,
// reusing src/lib/domain-icons.ts rather than inventing a second mapping —
// "call my parents" gets the family icon because it IS the family area on
// Today, and the two screens should agree.
//
// Sprout is the last resort, which is where an unanchored habit lands: on
// theme (Canteiro = garden bed) and honest about knowing nothing.
export function habitIcon(
  templateKind: string | null,
  domainSlug?: DomainSlug | string | null
): LucideIcon {
  const kind = templateKindOf(templateKind);
  if (kind !== "plain") return ICON_BY_KIND[kind] ?? Sprout;
  if (domainSlug && isDomainSlug(domainSlug)) return domainIcon(domainSlug);
  return Sprout;
}
