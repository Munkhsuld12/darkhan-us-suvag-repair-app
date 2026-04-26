import type { ReactNode } from "react";

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center sm:px-5 sm:py-7">
    <h3 className="text-sm font-semibold text-ink-900 sm:text-base">{title}</h3>
    {description ? <p className="mt-1.5 text-sm text-slate-500">{description}</p> : null}
    {action ? <div className="mt-3.5 flex justify-center">{action}</div> : null}
  </div>
);
