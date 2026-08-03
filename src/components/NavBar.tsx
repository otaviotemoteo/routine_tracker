"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { LanguageSelect } from "@/components/landing/LanguageSelect";
import { logout } from "@/app/login/actions";
import type { Copy, Lang } from "@/lib/i18n";

interface NavBarProps {
  lang: Lang;
  copy: Copy["nav"];
}

// Rendered once in the (app) route-group layout so it persists across
// navigations instead of remounting per page.
export function NavBar({ lang, copy }: NavBarProps) {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: copy.today, active: pathname === "/" },
    {
      href: "/overview",
      label: copy.overview,
      active: pathname.startsWith("/overview"),
    },
  ];

  return (
    <nav
      aria-label={copy.label}
      className="sticky top-0 z-10 bg-cream border-b-2 border-forest"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-x-2 gap-y-2 py-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`min-h-[44px] inline-flex items-center px-4 sm:px-5 rounded-full border-2 border-forest font-semibold text-sm transition-[transform,box-shadow] duration-150 ${
                item.active
                  ? "bg-clover text-white shadow-hard"
                  : "bg-white text-forest hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelect current={lang} />
          <form action={logout}>
            <button
              type="submit"
              aria-label={copy.logout}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 rounded-full border-2 border-forest bg-white font-semibold text-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
            >
              <LogOut aria-hidden className="w-4 h-4" />
              {/* Icon alone on a phone: the nav row is already three controls
                  wide before the label. */}
              <span className="hidden sm:inline">{copy.logout}</span>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
