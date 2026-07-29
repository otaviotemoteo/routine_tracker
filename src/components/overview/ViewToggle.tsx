import Link from "next/link";
import type { Copy } from "@/lib/i18n";

interface ViewToggleProps {
  view: "week" | "month";
  copy: Copy["overview"];
}

// One track, two halves — a segmented control reads as "two views of the same
// thing", where separate pills read as two destinations.
export function ViewToggle({ view, copy }: ViewToggleProps) {
  const item = (active: boolean) =>
    `flex-1 min-h-[40px] inline-flex items-center justify-center rounded-lg font-semibold text-sm transition-colors ${
      active ? "bg-white text-forest shadow-hard-sm" : "text-forest/55"
    }`;

  return (
    <div
      role="tablist"
      aria-label={copy.title}
      className="flex items-center gap-1.5 bg-sand/70 rounded-card p-1 mb-5"
    >
      <Link
        href="/overview?view=week"
        role="tab"
        aria-selected={view === "week"}
        className={item(view === "week")}
      >
        {copy.weekTab}
      </Link>
      <Link
        href="/overview?view=month"
        role="tab"
        aria-selected={view === "month"}
        className={item(view === "month")}
      >
        {copy.monthTab}
      </Link>
    </div>
  );
}
