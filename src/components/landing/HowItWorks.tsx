import { CalendarCheck, LayoutGrid, TrendingUp } from "lucide-react";

const STEPS = [
  {
    icon: CalendarCheck,
    title: "Hoje",
    text: "Marque os hábitos do dia com um toque.",
  },
  {
    icon: LayoutGrid,
    title: "Semana",
    text: "Veja o grid de consistência, dia a dia.",
  },
  {
    icon: TrendingUp,
    title: "Mês",
    text: "Acompanhe a adesão e a sequência de cada hábito.",
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-label="Como funciona" className="mt-14">
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="bg-white border-2 border-forest rounded-card shadow-hard p-5"
          >
            <step.icon aria-hidden className="w-6 h-6 text-clover" />
            <p className="font-semibold mt-2">{step.title}</p>
            <p className="text-sm opacity-75 mt-1">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
