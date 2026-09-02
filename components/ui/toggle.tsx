"use client";

import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  required,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-4 rounded-lg border border-ink-900/8 bg-cream-0 p-4",
        disabled && "opacity-60"
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-teal-700" : "bg-ink-900/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-cream-0 shadow transition-transform duration-150",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink-900">
          {label}
          {required && <span className="ml-1 text-clay-600">*</span>}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm text-ink-500">{description}</span>
        )}
      </span>
    </label>
  );
}
