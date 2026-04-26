import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    "border border-brand-700 bg-brand-700 text-white hover:bg-brand-800 hover:border-brand-800 focus-visible:ring-brand-200",
  secondary:
    "border border-slate-200 bg-white text-ink-900 hover:bg-slate-50 focus-visible:ring-slate-200",
  ghost:
    "border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-200",
  danger:
    "border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:border-rose-700 focus-visible:ring-rose-200",
};

const sizeClass: Record<Size, string> = {
  sm: "min-h-[34px] rounded-xl px-3 py-1.5 text-xs",
  md: "min-h-[38px] rounded-xl px-3.5 py-2 text-sm",
  lg: "min-h-[42px] rounded-2xl px-4 py-2.5 text-sm",
};

export const Button = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth,
  type = "button",
  ...props
}: PropsWithChildren<ButtonProps>) => (
  <button
    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    type={type}
    {...props}
  >
    {children}
  </button>
);
