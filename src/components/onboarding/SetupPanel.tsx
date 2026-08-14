interface SetupPanelProps {
  // The small mono eyebrow — "TARGET WINDOW", "READING LIST".
  label: string;
  // One sentence on what this section does. Optional: some panels are a list
  // whose rows explain themselves.
  lead?: string;
  // Sits opposite the label — a count, usually.
  aside?: React.ReactNode;
  children: React.ReactNode;
}

// One block of setup on its own surface.
//
// The config screens used to be loose fields under a heading, and it showed:
// with three or four groups on a screen there was nothing saying where one
// ended and the next began, so a long form read as one undifferentiated wall.
// A panel per group is what turns it back into a handful of small questions.
//
// Deliberately the same anatomy as the numbered sections in the habit form —
// mono eyebrow, optional sentence, content — because they are the same idea
// and the app should only teach it once.
export function SetupPanel({ label, lead, aside, children }: SetupPanelProps) {
  return (
    <section className="border-2 border-forest rounded-card bg-white shadow-hard p-4 mb-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h2 className="font-mono text-[10px] font-bold tracking-widest opacity-60">
          {label}
        </h2>
        {aside}
      </div>
      {lead && <p className="text-sm opacity-75 mb-3">{lead}</p>}
      {children}
    </section>
  );
}
