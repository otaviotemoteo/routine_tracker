import type { Config } from "tailwindcss";

// Design system "Canteiro": cream paper, deep-green ink, hard offset shadows.
// Token names are English color names mapped from the README palette:
// cream = papel, forest = mata, clover = trevo, mint = broto,
// straw = palha, sand = cinza-palha. Never hardcode these hex values in
// components; always go through the Tailwind classes.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F7F3E8",
        forest: "#17281C",
        clover: "#3D9B4F",
        mint: "#E3EFE0",
        straw: "#D9A03F",
        sand: "#DCD9CC",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-jost)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        // Hard shadows, no blur — the design system's signature.
        hard: "4px 4px 0 #17281C",
        "hard-lg": "6px 6px 0 #17281C",
        "hard-sm": "1px 1px 0 #17281C",
      },
      borderRadius: {
        card: "12px",
      },
      keyframes: {
        // Countdown fill for the auto-dismissing confirmation dialog.
        fill: {
          from: { width: "0%" },
          to: { width: "100%" },
        },
        // Modals arrive and leave with a short rise, so they read as opening
        // rather than blinking into place.
        "dialog-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "dialog-out": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
        },
      },
      animation: {
        fill: "fill 5s linear forwards",
        "dialog-in": "dialog-in 150ms ease-out",
        "dialog-out": "dialog-out 140ms ease-in forwards",
      },
    },
  },
  plugins: [],
};

export default config;
