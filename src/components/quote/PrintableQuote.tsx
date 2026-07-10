import { formatCents } from "@/lib/money";
import type { PricingConfiguration, QuoteCalculationResult } from "@/lib/types";

interface PrintableQuoteProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
}

/**
 * Print-only quote layout. Hidden on screen (`hidden`) and shown only when
 * printing (`print:block`), so `window.print()` produces a clean, one-page
 * quote without any admin controls, navigation chrome, or app UI.
 */
export function PrintableQuote({ result, config }: PrintableQuoteProps) {
  const now = new Date();
  const priceableItems = result.lineItems.filter((li) => li.category !== "discount");
  const discountItems = result.lineItems.filter((li) => li.category === "discount");

  return (
    <div className="hidden print:block print:p-8 print:text-black" aria-hidden="true">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
        <h1 className="text-2xl font-bold">{config.officeName}</h1>
        <p className="text-sm">
          {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <h2 className="mt-4 text-lg font-semibold">Eyewear Quote (Estimate)</h2>

      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {priceableItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-300">
              <td className="py-1">{item.label}</td>
              <td className="py-1 text-right">{formatCents(item.amountCents)}</td>
            </tr>
          ))}
          {discountItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-300">
              <td className="py-1">{item.label}</td>
              <td className="py-1 text-right">-{formatCents(Math.abs(item.amountCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Retail total</span>
          <span>{formatCents(result.retailTotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Insurance contribution</span>
          <span>{formatCents(result.insuranceContributionCents)}</span>
        </div>
        {result.discountTotalCents > 0 ? (
          <div className="flex justify-between">
            <span>Discounts</span>
            <span>-{formatCents(result.discountTotalCents)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-2 border-black p-3">
        <p className="text-sm font-semibold uppercase">Patient Responsibility</p>
        <p className="text-3xl font-bold">{formatCents(result.patientResponsibilityCents)}</p>
      </div>

      <p className="mt-4 text-xs">{config.disclaimerText}</p>
    </div>
  );
}
