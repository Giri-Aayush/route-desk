// Form primitives for the route checker. Presentational and controlled; all state
// lives in the parent. Shape rule: cards are rounded-2xl, controls rounded-xl,
// chips and the switch track rounded-full. Orange is the one accent.

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint ? <p className="-mt-1 text-xs text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function ChipMultiSelect({
  options,
  selected,
  onToggle,
  maxHeightClass = "max-h-44",
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  maxHeightClass?: string;
}) {
  return (
    <div
      className={`flex ${maxHeightClass} flex-wrap gap-2 overflow-y-auto pr-1`}
    >
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-[0.97]",
              on
                ? "bg-foreground text-background"
                : "bg-foreground/[0.05] text-foreground/75 hover:bg-foreground/[0.09] hover:text-foreground",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NativeSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground transition hover:border-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-border/70 p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
              on
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
    >
      <span
        className={[
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-foreground/15",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </button>
  );
}
