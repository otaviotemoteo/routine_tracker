// Slug → lucide icon mapping. The database stores the README's emoji in
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

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  treino: Dumbbell,
  leitura: BookOpen,
  sono: Moon,
  rotina: AlarmClock,
  duolingo: Globe,
  espiritualidade: Church,
  hobby: Guitar,
};

// Sprout fallback keeps unknown/future habits on-theme (Canteiro = garden bed).
export function habitIcon(slug: string): LucideIcon {
  return ICON_BY_SLUG[slug] ?? Sprout;
}
