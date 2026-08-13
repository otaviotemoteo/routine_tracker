// Template kind → lucide icon. The database stores the README's emoji in
// habits.icon, but the UI never renders emoji — every habit gets an SVG icon.
import {
  AlarmClock,
  BookOpen,
  Church,
  Dumbbell,
  Globe,
  Guitar,
  Moon,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { domainIcon } from "./domain-icons";
import { isDomainSlug, type DomainSlug } from "./domains";
import { templateKindOf } from "./templates";

// The seven original habits, keyed by the template kind they carry (which for
// them is their old slug, so nothing about them changed).
const ICON_BY_KIND: Record<string, LucideIcon> = {
  treino: Dumbbell,
  leitura: BookOpen,
  sono: Moon,
  rotina: AlarmClock,
  duolingo: Globe,
  espiritualidade: Church,
  hobby: Guitar,
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
