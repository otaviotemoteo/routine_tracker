// Stable slug from a display name (used for languages and spiritual
// practices). Split out on its own — this used to live in lib/onboarding.ts
// alongside the old wizard's step vocabulary, but it's the one export that
// outlived the wizard: /config's save actions still need it.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
