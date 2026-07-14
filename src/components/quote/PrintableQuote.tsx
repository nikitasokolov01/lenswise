import { formatCents } from "@/lib/money";
import { formatUsageLabelForCustomer } from "@/lib/usageOptions";
import type { InsuranceBreakdown, PricingConfiguration, QuoteCalculationResult, UsageKey } from "@/lib/types";

interface CustomerEstimatePrintProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  usage: UsageKey | null;
}

/** Patient-owed copay/charge lines from the breakdown (non-zero only). */
function customerPatientLines(b: InsuranceBreakdown): Array<{ label: string; cents: number }> {
  return [
    { label: "Frame copay", cents: b.frameCopayCents },
    { label: "Lens copay", cents: b.lensCopayCents },
    { label: "Coating copay", cents: b.coatingCopayCents },
    { label: "Photochromic copay", cents: b.photochromicCopayCents },
    { label: "Other copay", cents: b.otherCopayCents },
    { label: "Other non-covered charge", cents: b.otherChargeCents },
  ].filter((line) => line.cents > 0);
}

/** Insurance-paid allowance/covered lines from the breakdown (non-zero only). */
function customerInsuranceLines(b: InsuranceBreakdown): Array<{ label: string; cents: number }> {
  return [
    { label: "Frame allowance", cents: b.frameAllowanceAppliedCents },
    { label: "Lens allowance", cents: b.lensAllowanceAppliedCents },
    { label: "Additional insurance credit", cents: b.additionalAllowanceAppliedCents },
    { label: "Frame covered by insurance", cents: b.frameCoveredCents },
    { label: "Lens covered by insurance", cents: b.lensCoveredCents },
    { label: "Coating covered by insurance", cents: b.coatingCoveredCents },
    { label: "Photochromic covered by insurance", cents: b.photochromicCoveredCents },
  ].filter((line) => line.cents > 0);
}

/**
 * Customer Estimate print layout: generalized product descriptions, no
 * prescription values, and no internal notes. Hidden on screen (`hidden`)
 * and shown only when printing (`print:block`), so `window.print()`
 * produces a clean, one-page quote without any admin controls, navigation
 * chrome, or app UI. Only one of CustomerEstimatePrint / InternalOrderWorksheetPrint
 * is ever mounted with `print:block` at a time — see QuoteBuilder.tsx.
 */
export function CustomerEstimatePrint({ result, config, usage }: CustomerEstimatePrintProps) {
  const now = new Date();
  const priceableItems = result.lineItems.filter((li) => li.category !== "discount");
  const discountItems = result.lineItems.filter((li) => li.category === "discount");
  const breakdown = result.insuranceBreakdown;
  const patientLines = breakdown ? customerPatientLines(breakdown) : [];
  const insuranceLines = breakdown ? customerInsuranceLines(breakdown) : [];
  // Off by default: generalized names, no material/technology description.
  const showExact = config.showExactTechnologyNamesOnCustomerQuotes;
  const usageLabel = formatUsageLabelForCustomer(usage, showExact);

  return (
    <div className="hidden print:block print:p-8 print:text-black" aria-hidden="true">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
        <h1 className="text-2xl font-bold">{config.officeName}</h1>
        <p className="text-sm">
          {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <h2 className="mt-4 text-lg font-semibold">Eyewear Quote (Estimate)</h2>

      {usageLabel ? <p className="mt-1 text-sm">Usage: {usageLabel}</p> : null}

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
              <td className="py-1">
                {showExact ? item.label : item.customerLabel}
                {showExact && item.description ? (
                  <span className="block text-xs text-gray-600">{item.description}</span>
                ) : null}
              </td>
              <td className="py-1 text-right">{formatCents(item.amountCents)}</td>
            </tr>
          ))}
          {discountItems.map((item) => (
            <tr key={item.id} className="border-b border-gray-300">
              <td className="py-1">{showExact ? item.label : item.customerLabel}</td>
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
        {patientLines.map((line) => (
          <div key={line.label} className="flex justify-between">
            <span>{line.label}</span>
            <span>{formatCents(line.cents)}</span>
          </div>
        ))}
        {insuranceLines.map((line) => (
          <div key={line.label} className="flex justify-between">
            <span>{line.label}</span>
            <span>-{formatCents(line.cents)}</span>
          </div>
        ))}
        {!breakdown && result.insuranceContributionCents > 0 ? (
          <div className="flex justify-between">
            <span>Insurance contribution</span>
            <span>-{formatCents(result.insuranceContributionCents)}</span>
          </div>
        ) : null}
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
