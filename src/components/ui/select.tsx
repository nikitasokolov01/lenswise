import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A native <select>, styled to match Input/MoneyField. Deliberately a real
 * <select> (not a custom listbox/combobox) so it gets full native keyboard,
 * screen-reader, and iPad Safari touch support for free — a large native
 * picker wheel is the most reliable control for choosing prescription
 * values on a tablet at the chair.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-md border border-navy-200 bg-white px-3 text-base text-navy-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
