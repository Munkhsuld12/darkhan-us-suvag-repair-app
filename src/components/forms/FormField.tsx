import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface ShellProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

const controlClass =
  "mt-1.5 min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-ink-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500";

const Shell = ({ label, hint, required, children }: ShellProps) => (
  <label className="block">
    <span className="text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </span>
    {children}
    {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
  </label>
);

export const TextInput = ({
  label,
  hint,
  required,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) => (
  <Shell label={label} hint={hint} required={required}>
    <input className={`${controlClass} ${className}`} {...props} />
  </Shell>
);

export const SelectInput = ({
  label,
  hint,
  required,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; children: ReactNode }) => (
  <Shell label={label} hint={hint} required={required}>
    <select className={`${controlClass} pr-10 ${className}`} {...props}>
      {children}
    </select>
  </Shell>
);

export const TextareaInput = ({
  label,
  hint,
  required,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) => (
  <Shell label={label} hint={hint} required={required}>
    <textarea className={`${controlClass} min-h-[96px] resize-y ${className}`} {...props} />
  </Shell>
);
