import { formatCents } from "@/lib/money";
import { formatPrescriptionSummaryLines } from "@/lib/prescriptionOptions";
import { derivePrescriptionForDisplay } from "@/lib/prescriptionDisplay";
import { formatUsageLabel } from "@/lib/usageOptions";
import type { CoverageMethod, PricingConfiguration, QuoteCalculationResult, QuoteInput } from "@/lib/types";

/** Renders a CoverageMethod as a short staff-facing label, e.g. "Copay $25.00", "Covered", or "Retail". */
function formatCoverageMethod(method: CoverageMethod): string {
  if (method.type === "copay") return `Copay ${formatCents(method.amountCents)}`;
  if (method.type === "covered") return "Covered";
  return "Retail";
}

interface InternalOrderWorksheetPrintProps {
  input: QuoteInput;
  result: QuoteCalculationResult;
  config: PricingConfiguration;
}

/**
 * Internal Order Worksheet print layout: exact products, prescription,
 * copays/allowances, internal notes, and full surfacing-fee detail
 * (including any eligible-but-not-charged reason, since two surfacing
 * rules can never stack). This is a staff/lab document — never hand it to
 * the patient. Hidden on screen (`hidden`) and shown only when printing
 * (`print:block`); only one of CustomerEstimatePrint /
 * InternalOrderWorksheetPrint is ever mounted with `print:block` at a
 * time — see QuoteBuilder.tsx.
 */
export function InternalOrderWorksheetPrint({ input, result, config }: InternalOrderWorksheetPrintProps) {
  const now = new Date();
  const lensType = input.lensTypeId ? config.lensTypes.find((lt) => lt.id === input.lensTypeId) : undefined;
  const progressiveDesign = input.progressiveDesignId
    ? config.progressiveDesigns.find((d) => d.id === input.progressiveDesignId)
    : undefined;
  const material = input.materialId ? config.materials.find((m) => m.id === input.materialId) : undefined;
  const coating = input.coatingId ? config.coatings.find((c) => c.id === input.coatingId) : undefined;
  const photochromicProduct = input.photochromic.productId
    ? config.photochromicProducts.find((p) => p.id === input.photochromic.productId)
    : undefined;
  const photochromicColor = input.photochromic.colorId
    ? config.photochromicColors.find((c) => c.id === input.photochromic.colorId)
    : undefined;

  const priceableItems = result.lineItems.filter((li) => li.category !== "discount");
  const discountItems = result.lineItems.filter((li) => li.category === "discount");
  const coverage = input.insurance.coverage;

  // Exact (staff-facing) usage label (informational only), and the single
  // display-only prescription for the selected display mode. The applied
  // prescription in quote state is never changed.
  const usageLabel = formatUsageLabel(input.usage);
  const rxDisplay = input.prescription
    ? derivePrescriptionForDisplay(input.prescription, input.prescriptionDisplayMode)
    : null;

  const tintColor = input.tint.colorId
    ? config.tints.colors.find((c) => c.id === input.tint.colorId)
    : undefined;
  const tintDescription =
    input.tint.type === "none"
      ? "None"
      : `${tintColor?.name ?? "—"} ${input.tint.type === "solid" ? "Solid" : "Gradient"} Tint${
          input.tint.percent != null ? ` — ${input.tint.percent}%` : ""
        }`;

  return (
    <div className="hidden print:block print:p-8 print:text-black" aria-hidden="true">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
        <h1 className="text-2xl font-bold">{config.officeName}</h1>
        <p className="text-sm">
          {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <h2 className="mt-2 text-lg font-semibold uppercase tracking-wide">
        Internal Order Worksheet — not for patient
      </h2>

      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase text-gray-700">Exact products</h3>
        <table className="mt-1 w-full border-collapse text-sm">
          <tbody>
            <Row label="Usage" value={usageLabel ?? "—"} />
            <Row label="Frame" value={input.frame.customDescription || "—"} />
            <Row label="Frame retail price" value={formatCents(input.frame.retailPriceCents)} />
            <Row label="Lens type" value={lensType?.name ?? "—"} />
            {progressiveDesign ? <Row label="Progressive design" value={progressiveDesign.name} /> : null}
            <Row label="Material" value={material?.name ?? "—"} />
            <Row label="Coating" value={coating?.name ?? "—"} />
            <Row
              label="Photochromic"
              value={
                photochromicProduct
                  ? photochromicColor
                    ? `${photochromicProduct.name} — ${photochromicColor.name}`
                    : photochromicProduct.name
                  : "None"
              }
            />
            <Row label="Tint" value={tintDescription} />
          </tbody>
        </table>
      </section>

      {rxDisplay ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold uppercase text-gray-700">{rxDisplay.label}</h3>
          {rxDisplay.mode !== "original" ? (
            <p className="mt-1 text-xs text-gray-600">
              Display-only calculation — the entered prescription is unchanged.
              {rxDisplay.mode === "reading"
                ? " The full ADD has been combined into each eye's sphere."
                : " Half the ADD has been combined into each eye's sphere."}
            </p>
          ) : null}
          <pre className="mt-1 whitespace-pre-wrap font-mono text-sm leading-6">
            {formatPrescriptionSummaryLines(rxDisplay.prescription).join("\n")}
          </pre>
        </section>
      ) : null}

      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase text-gray-700">Pricing</h3>
        <table className="mt-1 w-full border-collapse text-sm">
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
                  {item.label}
                  {item.description ? <span className="block text-xs text-gray-600">{item.description}</span> : null}
                </td>
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
      </section>

      {result.surfacingFeeReasons.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold uppercase text-gray-700">Surfacing fee eligibility</h3>
          <table className="mt-1 w-full border-collapse text-sm">
            <tbody>
              {result.surfacingFeeReasons.map((reason) => (
                <tr key={reason.key} className="border-b border-gray-300">
                  <td className="py-1">
                    {reason.label}
                    {reason.charged ? (
                      <span className="ml-2 font-semibold">(charged)</span>
                    ) : (
                      <span className="ml-2 text-gray-600">(eligible, not charged — lower amount)</span>
                    )}
                  </td>
                  <td className="py-1 text-right">{formatCents(reason.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="mt-4">
        <h3 className="text-sm font-semibold uppercase text-gray-700">Insurance</h3>
        <table className="mt-1 w-full border-collapse text-sm">
          <tbody>
            <Row label="Mode" value={MODE_LABEL[input.insurance.mode]} />
            {input.insurance.mode === "insurance" ? (
              <>
                <Row label="Frame coverage" value={formatCoverageMethod(coverage.frameCoverage)} />
                <Row label="Frame allowance" value={formatCents(coverage.frameAllowanceCents)} />
                <Row label="Base lens coverage" value={formatCoverageMethod(coverage.lensCoverage)} />
                <Row label="Lens allowance" value={formatCents(coverage.lensAllowanceCents)} />
                <Row label="Material coverage" value={formatCoverageMethod(coverage.materialCoverage)} />
                <Row label="Coating coverage" value={formatCoverageMethod(coverage.coatingCoverage)} />
                <Row label="Photochromic coverage" value={formatCoverageMethod(coverage.photochromicCoverage)} />
                {input.tint.type !== "none" ? (
                  <Row label="Tint coverage" value={formatCoverageMethod(coverage.tintCoverage)} />
                ) : null}
                <Row label="Other copay" value={formatCents(coverage.otherCopayCents)} />
                <Row label="Additional allowance/credit" value={formatCents(coverage.additionalAllowanceCents)} />
                <Row label="Other non-covered charge" value={formatCents(coverage.otherChargeCents)} />
                <Row label="Copay total (patient)" value={formatCents(result.copayTotalCents)} />
                <Row label="Insurance contribution (total)" value={formatCents(result.insuranceContributionCents)} />
                <Row label="Unused allowance" value={formatCents(result.unusedAllowanceCents)} />
                {coverage.note ? <Row label="Insurance note" value={coverage.note} /> : null}
              </>
            ) : null}
            {input.insurance.mode === "manual" ? (
              <>
                <Row
                  label="Pre-override calculated total"
                  value={formatCents(result.preOverridePatientResponsibilityCents ?? 0)}
                />
                <Row label="Override note" value={input.insurance.manualOverride.note || "—"} />
              </>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="mt-4 border-2 border-black p-3">
        <p className="text-sm font-semibold uppercase">Patient Responsibility</p>
        <p className="text-3xl font-bold">{formatCents(result.patientResponsibilityCents)}</p>
      </div>

      {result.warnings.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold uppercase text-gray-700">Warnings</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const MODE_LABEL: Record<QuoteInput["insurance"]["mode"], string> = {
  retail: "Retail / Self-Pay",
  insurance: "Use Insurance",
  manual: "Manual Final Price Override",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-300">
      <td className="py-1 pr-4 font-medium">{label}</td>
      <td className="py-1 text-right">{value}</td>
    </tr>
  );
}
