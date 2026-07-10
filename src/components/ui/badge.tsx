import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "teal" | "warning" | "outline";
}) {
  const variants: Record<string, string> = {
    default: "bg-navy-100 text-navy-700",
    teal: "bg-teal-100 text-teal-800",
    warning: "bg-amber-100 text-amber-900",
    outline: "border border-navy-200 text-navy-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
