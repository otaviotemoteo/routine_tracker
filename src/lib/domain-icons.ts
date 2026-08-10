import {
  Baby,
  Briefcase,
  Church,
  GraduationCap,
  Heart,
  HeartHandshake,
  HeartPulse,
  Leaf,
  Palette,
  Sprout,
  TentTree,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { DomainSlug } from "./domains";

// One icon per life domain, mirroring src/lib/icons.ts.
//
// Lucide, never emoji: the design system forbids emoji in the UI, and an icon
// that inherits currentColor can sit on mint, straw or white without being
// redrawn. These carry no meaning on their own — every row they appear on also
// names the domain in words.
const ICON_BY_DOMAIN: Record<DomainSlug, LucideIcon> = {
  family: Users,
  couple: Heart,
  parenting: Baby,
  friends: UsersRound,
  work: Briefcase,
  education: GraduationCap,
  recreation: TentTree,
  spirituality: Church,
  community: HeartHandshake,
  health: HeartPulse,
  environment: Leaf,
  art: Palette,
};

export function domainIcon(slug: DomainSlug): LucideIcon {
  return ICON_BY_DOMAIN[slug] ?? Sprout;
}
