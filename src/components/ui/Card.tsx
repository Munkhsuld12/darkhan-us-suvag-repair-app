import type { HTMLAttributes, PropsWithChildren } from "react";

const hasBackgroundOverride = (className: string) => /\b!?bg-[^\s]+/.test(className);

type Padding = "none" | "sm" | "md" | "lg";

const paddingClass: Record<Padding, string> = {
  none: "p-0",
  sm: "p-3.5 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
}

export const Card = ({
  children,
  className = "",
  padding = "md",
  ...props
}: PropsWithChildren<CardProps>) => {
  const backgroundClass = hasBackgroundOverride(className) ? "" : "bg-white";

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 ${backgroundClass} ${paddingClass[padding]} shadow-card sm:rounded-[28px] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
