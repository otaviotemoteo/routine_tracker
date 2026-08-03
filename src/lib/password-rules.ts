// The password rules, in one place: the live checklist while typing and the
// server-side check on submit read from the same list, so the form can never
// accept something the action rejects.

export type PasswordRuleId = "length" | "number" | "symbol";

export const MIN_PASSWORD_LENGTH = 8;

const TESTS: Record<PasswordRuleId, (value: string) => boolean> = {
  length: (v) => v.length >= MIN_PASSWORD_LENGTH,
  number: (v) => /\d/.test(v),
  symbol: (v) => /[^A-Za-z0-9]/.test(v),
};

export const PASSWORD_RULES: PasswordRuleId[] = ["length", "number", "symbol"];

export function checkPassword(value: string): Record<PasswordRuleId, boolean> {
  return {
    length: TESTS.length(value),
    number: TESTS.number(value),
    symbol: TESTS.symbol(value),
  };
}

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => TESTS[rule](value));
}
