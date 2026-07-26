import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface IllustratedOptionCardProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "title"> {
  title: string;
  description?: string;
  priceLabel?: string;
  badge?: string;
  illustration: React.ReactNode;
}

/**
 * A native-radio selection card with room for explanatory lens artwork.
 * The entire surface is touch-friendly and keyboard accessible.
 */
export const IllustratedOptionCard = React.forwardRef<HTMLInputElement, IllustratedOptionCardProps>(
  ({ title, description, priceLabel, badge, illustration, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group relative flex min-h-[108px] cursor-pointer items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 shadow-sm transition",
          "hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-card",
          "has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 has-[:checked]:ring-1 has-[:checked]:ring-teal-600",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 has-[:focus-visible]:ring-offset-2",
          "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:disabled]:hover:translate-y-0",
          className
        )}
      >
        <input ref={ref} id={inputId} type="radio" className="peer sr-only" {...props} />
        <span className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-teal-700 transition-colors group-has-[:checked]:bg-teal-100">
          {illustration}
        </span>
        <span className="min-w-0 flex-1 pr-9">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-navy-900">{title}</span>
            {badge ? (
              <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy-600">
                {badge}
              </span>
            ) : null}
          </span>
          {description ? <span className="mt-1 block text-sm leading-5 text-navy-500">{description}</span> : null}
          {priceLabel ? (
            <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-navy-900 shadow-sm ring-1 ring-navy-100 tabular-nums group-has-[:checked]:ring-teal-200">
              {priceLabel}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-navy-200 bg-white text-white transition peer-checked:border-teal-600 peer-checked:bg-teal-600"
        >
          <Check className="h-4 w-4 opacity-0 group-has-[:checked]:opacity-100" strokeWidth={3} />
        </span>
      </label>
    );
  }
);
IllustratedOptionCard.displayName = "IllustratedOptionCard";
