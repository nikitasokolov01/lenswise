"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import { Select } from "@/components/ui/select";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import { formatCents } from "@/lib/money";
import type { AdjustmentPresetConfig, AdjustmentType } from "@/lib/types";

const TYPES: Record<AdjustmentType, string> = {
  fixed_discount: "Fixed-dollar discount",
  percent_discount: "Percentage discount",
  charge: "Custom charge",
  credit: "Custom credit",
};

export function AdjustmentPresetsSection({
  presets,
  onChange,
}: {
  presets: AdjustmentPresetConfig[];
  onChange: (presets: AdjustmentPresetConfig[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick adjustments</CardTitle>
        <CardDescription>
          Save common discounts, charges, and credits for one-tap use on a pair. For example, $100 off a first purchase
          or 50% off a second pair. Selecting a preset does not change other pairs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={presets}
          onChange={onChange}
          addLabel="Add quick adjustment"
          getName={(item) => item.label || "Unnamed adjustment"}
          getSubtitle={(item) => `${TYPES[item.type]} · ${item.type === "percent_discount" ? `${item.percent}%` : formatCents(item.amountCents)}`}
          createNew={(): AdjustmentPresetConfig => ({
            id: generateId("adjustment-preset"),
            label: "New discount",
            type: "fixed_discount",
            amountCents: 0,
            percent: 0,
            active: true,
            sortOrder: presets.reduce((max, preset) => Math.max(max, preset.sortOrder), -1) + 1,
          })}
          renderFields={(item, update) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${item.id}-label`}>Button and quote label</Label>
                <Input
                  id={`${item.id}-label`}
                  maxLength={40}
                  placeholder="First purchase discount"
                  value={item.label}
                  onChange={(event) => update({ label: event.target.value })}
                />
                <p className="mt-1 text-xs text-navy-400">Use an anonymous promotion name.</p>
              </div>
              <div>
                <Label htmlFor={`${item.id}-type`}>Adjustment type</Label>
                <Select
                  id={`${item.id}-type`}
                  value={item.type}
                  onChange={(event) => update({ type: event.target.value as AdjustmentType })}
                >
                  {(Object.entries(TYPES) as [AdjustmentType, string][]).map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${item.id}-value`}>{item.type === "percent_discount" ? "Percent off" : "Amount"}</Label>
                {item.type === "percent_discount" ? (
                  <Input
                    id={`${item.id}-value`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.1"
                    value={item.percent}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      update({ percent: Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0 });
                    }}
                  />
                ) : (
                  <MoneyField
                    id={`${item.id}-value`}
                    valueCents={item.amountCents}
                    onChangeCents={(amountCents) => update({ amountCents })}
                  />
                )}
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
