import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-navy-200 bg-white px-3.5 text-base text-navy-900 shadow-[0_1px_0_rgba(16,36,62,0.03)] placeholder:text-navy-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:border-teal-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
