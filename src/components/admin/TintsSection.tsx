"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import { createDefaultTintConfig } from "@/lib/pricing/seedConfiguration";
import type { TintColorConfig, TintConfig } from "@/lib/types";

interface TintsSectionProps {
  tints: TintConfig;
  onChange: (tints: TintConfig) => void;
}

export function TintsSection({ tints, onChange }: TintsSectionProps) {
  function handleRestoreDefaults() {
    if (window.confirm("Restore default tint colors and pricing? This replaces the current tint configuration.")) {
      onChange(createDefaultTintConfig());
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tints</CardTitle>
        <CardDescription>
          Solid and gradient lens tints. Prices are configured independently per color, per type, and per 10%
          interval, in integer cents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <CheckboxField
            label="Enable Solid Tint"
            checked={tints.solidTintEnabled}
            onChange={(e) => onChange({ ...tints, solidTintEnabled: e.target.checked })}
          />
          <CheckboxField
            label="Enable Gradient Tint"
            checked={tints.gradientTintEnabled}
            onChange={(e) => onChange({ ...tints, gradientTintEnabled: e.target.checked })}
          />
        </div>

        <EditableList
          items={tints.colors}
          onChange={(colors) => onChange({ ...tints, colors })}
          addLabel="Add tint color"
          getName={(item) => item.name}
          getSubtitle={(item) =>
            [item.supportsSolid ? "Solid" : null, item.supportsGradient ? "Gradient" : null]
              .filter(Boolean)
              .join(" · ") || "No types enabled"
          }
          createNew={(): TintColorConfig => ({
            id: generateId("tint"),
            name: "New Color",
            customerLabel: "New Color",
            active: true,
            sortOrder: tints.colors.length,
            supportsSolid: true,
            supportsGradient: true,
            solidPriceCents: 0,
            gradientPriceCents: 0,
          })}
          renderFields={(item, update) => (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${item.id}-name`}>Color name (internal)</Label>
                  <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`${item.id}-customer`}>Customer-facing label</Label>
                  <Input
                    id={`${item.id}-customer`}
                    value={item.customerLabel}
                    onChange={(e) => update({ customerLabel: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <CheckboxField
                  label="Supports Solid Tint"
                  checked={item.supportsSolid}
                  onChange={(e) => update({ supportsSolid: e.target.checked })}
                />
                <CheckboxField
                  label="Supports Gradient Tint"
                  checked={item.supportsGradient}
                  onChange={(e) => update({ supportsGradient: e.target.checked })}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${item.id}-solid-price`}>Solid Tint price</Label>
                  <MoneyField
                    id={`${item.id}-solid-price`}
                    valueCents={item.solidPriceCents}
                    onChangeCents={(cents) => update({ solidPriceCents: cents })}
                    disabled={!item.supportsSolid}
                    aria-label={`${item.name} solid tint price`}
                  />
                </div>
                <div>
                  <Label htmlFor={`${item.id}-gradient-price`}>Gradient Tint price</Label>
                  <MoneyField
                    id={`${item.id}-gradient-price`}
                    valueCents={item.gradientPriceCents}
                    onChangeCents={(cents) => update({ gradientPriceCents: cents })}
                    disabled={!item.supportsGradient}
                    aria-label={`${item.name} gradient tint price`}
                  />
                </div>
              </div>
              <p className="text-xs text-navy-400">One price per tint type — the selected percentage does not affect price.</p>
            </div>
          )}
        />

        <Button variant="secondary" size="sm" onClick={handleRestoreDefaults}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restore tint defaults
        </Button>
      </CardContent>
    </Card>
  );
}
