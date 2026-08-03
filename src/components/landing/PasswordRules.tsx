"use client";

import { Check } from "lucide-react";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  checkPassword,
  type PasswordRuleId,
} from "@/lib/password-rules";
import { format, type Copy } from "@/lib/i18n";

interface PasswordRulesProps {
  value: string;
  copy: Copy["landing"];
}

// The rules, checked as you type. Shown as a checklist rather than an error
// after the fact: a password field you can't see is hard enough without being
// told what was wrong only once you've submitted it.
export function PasswordRules({ value, copy }: PasswordRulesProps) {
  const passed = checkPassword(value);
  const labels: Record<PasswordRuleId, string> = {
    length: format(copy.ruleLength, { n: MIN_PASSWORD_LENGTH }),
    number: copy.ruleNumber,
    symbol: copy.ruleSymbol,
  };

  return (
    <ul className="flex flex-col gap-1 list-none text-left">
      {PASSWORD_RULES.map((rule) => (
        <li
          key={rule}
          className={`flex items-center gap-2 text-xs font-semibold ${
            passed[rule] ? "text-clover" : "opacity-50"
          }`}
        >
          <span
            aria-hidden
            className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
              passed[rule] ? "border-clover bg-clover" : "border-forest/25"
            }`}
          >
            {passed[rule] && (
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
            )}
          </span>
          {labels[rule]}
          <span className="sr-only">{passed[rule] ? " ✓" : ""}</span>
        </li>
      ))}
    </ul>
  );
}
