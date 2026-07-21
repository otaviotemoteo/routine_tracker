"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

interface LanguageSelectProps {
  current: Lang;
}

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt", label: "PT" },
];

// Sets the lang cookie and re-renders the server page in the new language.
export function LanguageSelect({ current }: LanguageSelectProps) {
  const router = useRouter();

  function select(lang: Lang) {
    document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="inline-flex rounded-full border-2 border-forest bg-white shadow-hard overflow-hidden"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          onClick={() => select(option.value)}
          className={`min-h-[44px] min-w-[44px] px-4 font-semibold text-sm transition-colors duration-150 ${
            current === option.value
              ? "bg-clover text-white"
              : "bg-white text-forest hover:bg-mint"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
