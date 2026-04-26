import type { ReactNode } from "react";
import { useInternalHeader } from "../layout/InternalLayout";

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export const InternalMobileMenuAction = () => {
  const internalHeader = useInternalHeader();
  const mobileHeaderAction = internalHeader?.mobileHeaderAction;

  return mobileHeaderAction ? <div className="lg:hidden">{mobileHeaderAction}</div> : null;
};

export const PageHeader = ({ title, action }: PageHeaderProps) => {
  const internalHeader = useInternalHeader();
  const mobileHeaderAction = internalHeader?.mobileHeaderAction;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div className="flex items-start justify-between gap-3 sm:flex-1 sm:items-center">
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-[1.75rem]">{title}</h1>
        {mobileHeaderAction ? <div className="sm:hidden">{mobileHeaderAction}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div> : null}
    </div>
  );
};
