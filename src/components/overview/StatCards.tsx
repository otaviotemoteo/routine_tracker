export interface StatCard {
  label: string;
  value: string;
  note?: string;
  // "warn" tints the card straw — the one that needs attention.
  tone?: "neutral" | "warn";
}

interface StatCardsProps {
  cards: StatCard[];
}

// The three takeaways under a period view: what went best, what needs work,
// and one concrete figure.
export function StatCards({ cards }: StatCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`border-2 border-forest rounded-card shadow-hard px-4 py-3 ${
            card.tone === "warn" ? "bg-straw/15" : "bg-white"
          }`}
        >
          <p
            className={`text-[0.6rem] uppercase tracking-wider font-semibold ${
              card.tone === "warn" ? "text-straw" : "opacity-50"
            }`}
          >
            {card.label}
          </p>
          <p className="font-semibold mt-1">{card.value}</p>
          {card.note && (
            <p
              className={`text-xs font-medium mt-0.5 ${
                card.tone === "warn" ? "text-straw" : "text-clover"
              }`}
            >
              {card.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
