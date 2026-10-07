import { CustomerEstimatePrint } from "@/components/quote/PrintableQuote";
import { InternalOrderWorksheetPrint } from "@/components/quote/InternalOrderWorksheetPrint";
import type { CalculatedQuotePair } from "@/lib/calculation/quoteSession";
import type { PricingConfiguration } from "@/lib/types";
import type { OrganizationLocation } from "@/lib/locations/types";
import { formatCents } from "@/lib/money";

export function QuoteSessionPrint({ pairs, mode, config, location, totalCents }: {
  pairs: CalculatedQuotePair[];
  mode: "customer" | "internal";
  config: PricingConfiguration;
  location: OrganizationLocation;
  totalCents: number;
}) {
  return (
    <div className="hidden print:block print:text-black" aria-hidden="true">
      <div className="mb-4 border-b-2 border-black pb-3">
        <h1 className="text-xl font-bold">{config.officeName} · {location.name}</h1>
        <h2 className="text-lg font-semibold">{pairs.length}-pair quote · Combined responsibility: {formatCents(totalCents)}</h2>
        {pairs.map((pair) => <p key={pair.id} className="text-sm">{pair.label}: {formatCents(pair.result.patientResponsibilityCents)}</p>)}
      </div>
      {pairs.map((pair, index) => (
        <div key={pair.id} className={index > 0 ? "print:break-before-page" : ""}>
          <h2 className="mt-3 text-lg font-bold">{pair.label}</h2>
          {mode === "customer" ? (
            <CustomerEstimatePrint result={pair.result} config={config} usage={pair.input.usage} location={location} completedSale={pair.completedSale} />
          ) : (
            <InternalOrderWorksheetPrint input={pair.input} result={pair.result} config={config} location={location} completedSale={pair.completedSale} />
          )}
        </div>
      ))}
    </div>
  );
}
