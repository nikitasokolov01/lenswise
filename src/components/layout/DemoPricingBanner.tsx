import { AlertTriangle } from "lucide-react";
import { DEMO_PRICING_DISCLAIMER } from "@/lib/constants";

export function DemoPricingBanner() {
  return (
    <div
      role="note"
      className="no-print mb-5 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="text-sm text-amber-900">{DEMO_PRICING_DISCLAIMER}</p>
    </div>
  );
}
