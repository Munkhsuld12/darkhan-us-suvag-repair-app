interface SummaryCardProps {
  title: string;
  value: string | number;
  note?: string;
  tone?: "brand" | "blue" | "green" | "amber" | "rose";
}

const toneClass = {
  brand: "border-brand-200 bg-brand-50 text-brand-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
};

const noteClass = {
  brand: "text-brand-700/80",
  blue: "text-sky-700/80",
  green: "text-emerald-700/80",
  amber: "text-amber-700/80",
  rose: "text-rose-700/80",
};

export const SummaryCard = ({
  title,
  value,
  note,
  tone = "brand",
}: SummaryCardProps) => (
  <div className={`rounded-2xl border px-3.5 py-3.5 shadow-card sm:px-4 ${toneClass[tone]}`}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">{title}</p>
    <p className="mt-1.5 text-xl font-extrabold leading-none sm:text-2xl">{value}</p>
    {note ? <p className={`mt-1.5 text-[11px] sm:text-xs ${noteClass[tone]}`}>{note}</p> : null}
  </div>
);
