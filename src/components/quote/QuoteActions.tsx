"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Copy, RotateCcw, Eye, Check } from "lucide-react";
import { formatCents } from "@/lib/money";
import { formatUsageLabelForCustomer } from "@/lib/usageOptions";
import type { PricingConfiguration, QuoteCalculationResult, UsageKey } from "@/lib/types";

interface QuoteActionsProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  usage: UsageKey | null;
  onResetQuote: () => void;
  onOpenPatientView: () => void;
  onPrintCustomerEstimate: () => void;
  onPrintInternalWorksheet: () => void;
}

/**
 * Plain-text version of the Customer Estimate — the "Copy quote summary"
 * action produces a customer-shareable estimate, so it uses each line item's
 * generalized customerLabel (never an exact brand/technology) and itemizes
 * the insurance breakdown rather than collapsing it into a single line.
 */
function buildPlainTextSummary(
  result: QuoteCalculationResult,
  config: PricingConfiguration,
  usage: UsageKey | null
): string {
  const showExact = config.showExactTechnologyNamesOnCustomerQuotes;
  const lines: string[] = [];
  lines.push(config.officeName);
  lines.push("Eyewear Quote (Estimate)");
  const usageLabel = formatUsageLabelForCustomer(usage, showExact);
  if (usageLabel) lines.push(`Usage: ${usageLabel}`);
  lines.push("");
  for (const item of result.lineItems) {
    const amount = item.category === "discount" ? -Math.abs(item.amountCents) : item.amountCents;
    const sign = amount < 0 ? "-" : "";
    const name = showExact ? item.label : item.customerLabel;
    lines.push(`${name}: ${sign}${formatCents(Math.abs(amount))}`);
  }
  lines.push("");
  lines.push(`Retail total: ${formatCents(result.retailTotalCents)}`);

  const b = result.insuranceBreakdown;
  if (b) {
    const patientLines: Array<[string, number]> = [
      ["Frame copay", b.frameCopayCents],
      ["Lens copay", b.lensCopayCents],
      ["Coating copay", b.coatingCopayCents],
      ["Photochromic copay", b.photochromicCopayCents],
      ["Other copay", b.otherCopayCents],
      ["Other non-covered charge", b.otherChargeCents],
    ];
    const insuranceLines: Array<[string, number]> = [
      ["Frame allowance", b.frameAllowanceAppliedCents],
      ["Lens allowance", b.lensAllowanceAppliedCents],
      ["Additional insurance credit", b.additionalAllowanceAppliedCents],
      ["Frame covered by insurance", b.frameCoveredCents],
      ["Lens covered by insurance", b.lensCoveredCents],
      ["Coating covered by insurance", b.coatingCoveredCents],
      ["Photochromic covered by insurance", b.photochromicCoveredCents],
    ];
    for (const [label, cents] of patientLines) {
      if (cents > 0) lines.push(`${label}: ${formatCents(cents)}`);
    }
    for (const [label, cents] of insuranceLines) {
      if (cents > 0) lines.push(`${label}: -${formatCents(cents)}`);
    }
  } else if (result.insuranceContributionCents > 0) {
    lines.push(`Insurance contribution: -${formatCents(result.insuranceContributionCents)}`);
  }

  if (result.discountTotalCents > 0) {
    lines.push(`Discounts: -${formatCents(result.discountTotalCents)}`);
  }
  lines.push(`Patient responsibility: ${formatCents(result.patientResponsibilityCents)}`);
  lines.push("");
  lines.push(config.disclaimerText);
  return lines.join("\n");
}

export function QuoteActions({
  result,
  config,
  usage,
  onResetQuote,
  onOpenPatientView,
  onPrintCustomerEstimate,
  onPrintInternalWorksheet,
}: QuoteActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildPlainTextSummary(result, config, usage);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this quote summary:", text);
    }
  }

  function handleReset() {
    if (window.confirm("Reset this quote? All selections will be cleared.")) {
      onResetQuote();
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={handleReset}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset quote
      </Button>
      <Button variant="secondary" size="sm" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy quote summary"}
      </Button>
      <Button variant="secondary" size="sm" onClick={onPrintCustomerEstimate}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print Customer Estimate
      </Button>
      <Button variant="secondary" size="sm" onClick={onPrintInternalWorksheet}>
        <FileText className="h-4 w-4" aria-hidden="true" />
        Print Internal Worksheet
      </Button>
      <Button variant="accent" size="sm" onClick={onOpenPatientView}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        Open Patient View
      </Button>
    </div>
  );
}
