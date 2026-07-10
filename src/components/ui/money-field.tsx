"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { centsToDollarInputValue, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MoneyFieldProps {
  id?: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  allowNegative?: boolean;
  disabled?: boolean;
}

/**
 * A dollar-amount input that stores its authoritative value in integer
 * cents (via onChangeCents) while letting the optician type naturally in
 * dollars, e.g. "129.99". Uses inputMode="decimal" with a text input
 * (rather than type="number") so Safari on iPad shows the numeric keyboard
 * without the confusing +/- spinner UI, and so a 16px font size prevents
 * iOS Safari's automatic zoom-on-focus.
 */
export function MoneyField({
  id,
  valueCents,
  onChangeCents,
  placeholder = "0.00",
  className,
  allowNegative = false,
  disabled,
  ...aria
}: MoneyFieldProps) {
  const [text, setText] = React.useState(() => centsToDollarInputValue(valueCents));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setText(centsToDollarInputValue(valueCents));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents, isFocused]);

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 text-base">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="pl-6 tabular-nums"
        placeholder={placeholder}
        value={text}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          const raw = event.target.value;
          const filtered = allowNegative
            ? raw.replace(/[^0-9.-]/g, "")
            : raw.replace(/[^0-9.]/g, "");
          setText(filtered);
          onChangeCents(parseDollarsToCents(filtered));
        }}
        onBlur={() => {
          setIsFocused(false);
          setText(centsToDollarInputValue(valueCents));
        }}
        {...aria}
      />
    </div>
  );
}
