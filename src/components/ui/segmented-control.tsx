import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A touch-friendly button group used in place of a native <select> for short
 * mutually-exclusive option sets (e.g. copay coverage status). Implemented
 * as real <button> elements inside a radiogroup-labeled container so screen
 * readers announce the group and each option's pressed state.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-navy-200 bg-navy-50 p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[36px] rounded px-3 text-sm font-medium transition-colors",
              selected
                ? "bg-white text-navy-900 shadow-soft border border-navy-200"
                : "text-navy-500 hover:text-navy-700"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
