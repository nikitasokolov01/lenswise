import { Info } from "lucide-react";
import { PRICING_SETUP_NOTE } from "@/lib/constants";

/** Optional in-app reminder to configure pricing. Not shown by default. */
export function PricingSetupNote() {
  return (
    <div
      role="note"
      className="no-print mb-5 flex items-start gap-2.5 rounded-md border border-navy-200 bg-navy-50 px-4 py-3"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
      <p className="text-sm text-navy-700">{PRICING_SETUP_NOTE}</p>
    </div>
  );
}
