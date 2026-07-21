"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoje" },
  { href: "/semana", label: "Semana" },
  { href: "/mes", label: "Mês" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 z-10 bg-cream border-b-2 border-forest"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 sm:gap-2 py-2.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`min-h-[44px] inline-flex items-center px-4 sm:px-5 rounded-full border-2 border-forest font-semibold text-sm transition-[transform,box-shadow] duration-150 ${
                active
                  ? "bg-clover text-white shadow-hard"
                  : "bg-white text-forest hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
