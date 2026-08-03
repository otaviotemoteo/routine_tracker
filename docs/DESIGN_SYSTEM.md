# Design System: "Canteiro"

The visual identity: what the tokens are and where each one is allowed to go.
`UX_PRINCIPLES.md` covers behaviour. This covers appearance.

---

## Design System: "Canteiro"

Identity: cream paper, deep-green ink, offset hard shadows, thick-bordered cards. Retro-editorial aesthetic in green.

### Palette

In code (tailwind.config.ts) the tokens use English color names. The mapping is
fixed:

| Token | Tailwind name | Hex | Use |
|-------|---------------|-----|-----|
| `--papel` | `cream` | `#F7F3E8` | Overall background |
| `--mata` | `forest` | `#17281C` | Text, borders, hard shadows |
| `--trevo` | `clover` | `#3D9B4F` | Accent: primary buttons, completed checks, done cells |
| `--broto` | `mint` | `#E3EFE0` | Soft fills: hover, marked card, section tint |
| `--palha` | `straw` | `#D9A03F` | Streaks, achievement highlights, and the "pending" state (a `straw/30` chip on Today's cards) |
| `--cinza-palha` | `sand` | `#DCD9CC` | Empty cells, unfilled bars, muted text together with `forest` opacity |

### Typography

- **Fraunces** (700/900), titles and headings, with `font-variant-caps: small-caps` and wide letter-spacing on screen titles ("Today", "Week", "Month")
- **Jost** (400/500/600), body, labels, buttons - **JetBrains Mono** (500/700), numbers: percentages, counters (4/6), streaks

### Signature Components

- **Hard shadow:** `box-shadow: 4px 4px 0 var(--mata)` on cards and buttons (6px on button hover, with a -2px translate). No blur, ever.
- **Borders:** `2px solid var(--mata)`, 10–12px radius on cards, pill buttons (full radius).
- **Completed habit card:** `--broto` fill, check in `--trevo`.
- **Hobby card:** `2px dashed` border, small "optional" label.
- **Week grid:** square cells with 4px radius. Done in `--trevo`, empty in `--cinza-palha`, both with a thin border of `--mata` at 15% opacity.
- **Eyebrow:** small caps label with a left dash (like the reference's "- RESERVATIONS"), in `--trevo`.

Full preview in `identidade-visual.html` (historical reference, gitignored). The UI never renders emoji: habit icons are lucide-react SVGs mapped by slug in `src/lib/icons.ts` (the emoji in the database `icon` column is legacy seed data, unused by the interface).
