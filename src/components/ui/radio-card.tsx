import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioCardProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  title: string;
  subtitle?: string;
  priceLabel?: string;
  name: string;
}

/**
 * A large, touch-friendly option card built on a native radio input for full
 * keyboard and screen-reader support without any custom ARIA. Group several
 * RadioCards with the same `name` inside a <div role="radiogroup"> (see
 * RadioCardGroup below) to form one selectable option set.
 */
export const RadioCard = React.forwardRef<HTMLInputElement, RadioCardProps>(
  ({ title, subtitle, priceLabel, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "relative flex min-h-[64px] cursor-pointer flex-col justify-center gap-0.5 rounded-lg border border-navy-200 bg-white px-4 py-3",
          "has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:checked]:ring-1 has-[:checked]:ring-teal-600",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600",
          "has-[:disabled]:opacity-40 has-[:disabled]:cursor-not-allowed",
          className
        )}
      >
        <input ref={ref} id={inputId} type="radio" className="peer sr-only" {...props} />
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium text-navy-900">{title}</span>
          {priceLabel ? (
            <span className="shrink-0 text-[15px] font-semibold text-navy-900 tabular-nums">
              {priceLabel}
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="text-xs text-navy-500">{subtitle}</span> : null}
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 hidden h-2.5 w-2.5 rounded-full bg-teal-600 peer-checked:block"
        />
      </label>
    );
  }
);
RadioCard.displayName = "RadioCard";

export function RadioCardGroup({
  legend,
  className,
  children,
}: {
  legend: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={legend} className={cn("grid gap-2.5", className)}>
      {children}
    </div>
  );
}
