import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

/**
 * A native checkbox styled as a large, touch-friendly toggle. Using a real
 * <input type="checkbox"> keeps keyboard support, screen reader semantics,
 * and iOS/Safari behavior fully native rather than reimplementing a switch.
 */
export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, description, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-start gap-3 rounded-md border border-navy-200 bg-white px-4 py-3 min-h-[44px] cursor-pointer select-none",
          "has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600",
          className
        )}
      >
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-navy-300 bg-white has-[:checked]:bg-teal-600 has-[:checked]:border-teal-600">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            {...props}
          />
          <Check
            aria-hidden="true"
            className="pointer-events-none hidden h-4 w-4 text-white peer-checked:block"
          />
        </span>
        <span>
          <span className="block text-sm font-medium text-navy-900">{label}</span>
          {description ? (
            <span className="block text-xs text-navy-500 mt-0.5">{description}</span>
          ) : null}
        </span>
      </label>
    );
  }
);
CheckboxField.displayName = "CheckboxField";
