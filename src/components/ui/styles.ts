// Shared Tailwind class strings, so every screen's inputs and buttons look
// identical.
//
// This module carries NO "use client" directive, and that is the point. Every
// export of a client module becomes a client-reference proxy, so a Server
// Component that interpolates one of these into a template literal —
// `${primaryButton} mt-4` — stringifies the proxy and emits a class attribute
// containing a thrown error instead of the classes. Direct assignment happens
// to survive; interpolation does not, which makes the failure silent and
// intermittent. Keeping the strings in a plain module makes it impossible.

// Carries no width — use it when the caller sets its own, because two width
// utilities on one element fight and the stylesheet order decides.
export const fieldBase =
  "min-h-[44px] px-3 border-2 border-forest rounded-lg bg-cream focus:bg-white";

export const inputClass = `${fieldBase} w-full`;

export const primaryButton =
  "min-h-[48px] inline-flex items-center justify-center gap-2 px-7 rounded-full border-2 border-forest bg-clover text-white font-semibold shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-hard";

export const ghostButton =
  "min-h-[44px] inline-flex items-center justify-center px-5 rounded-full border-2 border-forest bg-white font-semibold text-sm shadow-hard transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm";

// The panel every "explain this" and "here is a group of related facts" block
// uses: white so it lifts off the cream page, hard-shadowed like everything
// else in the system.
export const cardSurface =
  "border-2 border-forest rounded-card bg-white shadow-hard";
