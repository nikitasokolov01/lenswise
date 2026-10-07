"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import type { FrameAllowanceShortcutsConfig } from "@/lib/types";

export function FrameAllowanceShortcutsSection({
  shortcuts,
  onChange,
}: {
  shortcuts: FrameAllowanceShortcutsConfig;
  onChange: (shortcuts: FrameAllowanceShortcutsConfig) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Frame allowance quick buttons</CardTitle>
        <CardDescription>
          Set up to three common insurance frame allowances. Staff can tap one to fill the allowance for the current
          pair, then still edit the amount manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CheckboxField
          label="Show frame allowance quick buttons in Quote Builder"
          checked={shortcuts.enabled}
          onChange={(event) => onChange({ ...shortcuts, enabled: event.target.checked })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {shortcuts.amountsCents.map((amount, index) => (
            <div key={index}>
              <Label htmlFor={`allowance-shortcut-${index}`}>Option {index + 1}</Label>
              <div className="flex items-center gap-2">
                <MoneyField
                  id={`allowance-shortcut-${index}`}
                  valueCents={amount}
                  onChangeCents={(value) => onChange({
                    ...shortcuts,
                    amountsCents: shortcuts.amountsCents.map((existing, optionIndex) => optionIndex === index ? value : existing),
                  })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove allowance option ${index + 1}`}
                  className="shrink-0 text-navy-400 hover:text-red-600"
                  onClick={() => onChange({ ...shortcuts, amountsCents: shortcuts.amountsCents.filter((_, optionIndex) => optionIndex !== index) })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {shortcuts.amountsCents.length < 3 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const nextAmount = [10000, 20000, 32500, 0].find((amount) => !shortcuts.amountsCents.includes(amount)) ?? 0;
              onChange({ ...shortcuts, amountsCents: [...shortcuts.amountsCents, nextAmount] });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add allowance option
          </Button>
        ) : null}
        <p className="text-xs text-navy-500">These are shortcuts only. They do not change your default allowance or verify benefits.</p>
      </CardContent>
    </Card>
  );
}
