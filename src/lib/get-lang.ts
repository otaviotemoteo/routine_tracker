import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLang, type Lang } from "@/lib/i18n";

// Server-only: reads the language cookie for Server Components/actions.
export async function getLang(): Promise<Lang> {
  return resolveLang((await cookies()).get(LANG_COOKIE)?.value);
}
