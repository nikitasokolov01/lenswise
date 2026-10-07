"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import type { CalculatedQuotePair } from "@/lib/calculation/quoteSession";

interface Props {
  pairs: CalculatedQuotePair[];
  activePairId: string;
  totalCents: number;
  canAddPair: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function QuoteSessionOverview({ pairs, activePairId, totalCents, canAddPair, onSelect, onAdd, onRemove }: Props) {
  return (
    <section aria-label="Pairs in this quote" className="no-print mb-5 rounded-2xl border border-navy-100 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy-800">{pairs.length === 1 ? "Your quote" : `${pairs.length} pairs in this quote`}</p>
        <p className="text-sm text-navy-600">Combined total <span className="ml-2 text-lg font-bold text-navy-950 tabular-nums">{formatCents(totalCents)}</span></p>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {pairs.map((pair) => (
          <div key={pair.id} className={`flex min-w-0 max-w-full items-center rounded-xl border ${pair.id === activePairId ? "border-teal-600 bg-teal-50" : "border-navy-100"}`}>
            <button type="button" onClick={() => onSelect(pair.id)} aria-pressed={pair.id === activePairId} className="min-h-[48px] min-w-0 rounded-xl px-3 py-2 text-left">
              <span className="block text-sm font-bold text-navy-900">{pair.label} · {formatCents(pair.result.patientResponsibilityCents)}{pair.completedSale ? " · Paid" : ""}</span>
              <span className="block max-w-[220px] truncate text-xs text-navy-500">{pair.input.frame.customDescription || (pair.input.orderType === "lens_only" ? "Lens only" : "Choose a frame")}</span>
            </button>
            {pairs.length > 1 && !pair.completedSale ? (
              <button type="button" onClick={() => onRemove(pair.id)} aria-label={`Remove ${pair.label.toLowerCase()}`} className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-navy-400 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={onAdd} disabled={!canAddPair} title={!canAddPair ? "Finish this pair's required selections first." : undefined}>
          <Plus className="h-4 w-4" aria-hidden="true" />Add pair
        </Button>
      </div>
    </section>
  );
}
