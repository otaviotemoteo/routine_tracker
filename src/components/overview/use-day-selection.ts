"use client";

import { useEffect, useState } from "react";

// Which day's tooltip is open, shared by the week grid and the month calendar.
// Escape closes it: the tooltip is an overlay, and every overlay in the app has
// to be dismissable from the keyboard (UX_PRINCIPLES).
export function useDaySelection() {
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    if (openDay === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay]);

  return {
    openDay,
    open: (index: number) => setOpenDay(index),
    toggle: (index: number) =>
      setOpenDay((current) => (current === index ? null : index)),
    close: () => setOpenDay(null),
  };
}
