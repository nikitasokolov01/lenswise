"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Copy, RotateCcw, Eye, Check } from "lucide-react";
import { formatCents } from "@/lib/money";
import type { PricingConfiguration, QuoteCalculationResult } from "@/lib/types";

interface QuoteActionsProps {
  result: QuoteCalculationResult;
  config: PricingConfiguration;
  onResetQuote: () => void;
  onOpenPatientView: () => void;
}

function buildPlainTextSummary(result: QuoteCalculationResult, config: PricingConfiguration): string {
  const lines: string[] = [];
  lines.push(config.officeName);
  lines.push("Eyewear Quote (Estimate)");
  lines.push("");
  for (const item of result.lineItems) {
    const amount = item.category === "discount" ? -Math.abs(item.amountCents) : item.amountCents;
    const sign = amount < 0 ? "-" : "";
    lines.push(`${item.label}: ${sign}${formatCents(Math.abs(amount))}`);
  }
  lines.push("");
  lines.push(`Retail total: ${formatCents(result.retailTotalCents)}`);
  lines.push(`Insurance contribution: ${formatCents(result.insuranceContributionCents)}`);
  if (result.discountTotalCents > 0) {
    lines.push(`Discounts: -${formatCents(result.discountTotalCents)}`);
  }
  lines.push(`Patient responsibility: ${formatCents(result.patientResponsibilityCents)}`);
  lines.push("");
  lines.push(config.disclaimerText);
  return lines.join("\n");
}

export function QuoteActions({ result, config, onResetQuote, onOpenPatientView }: QuoteActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = buildPlainTextSummary(result, config);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this quote summary:", text);
    }
  }

  function handlePrint() {
    window.print();
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
      <Button variant="secondary" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print quote
      </Button>
      <Button variant="accent" size="sm" onClick={onOpenPatientView}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        Open Patient View
      </Button>
    </div>
  );
}
