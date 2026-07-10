"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/ui/money-field";
import type { DefaultAllowances, DefaultCopays } from "@/lib/types";

export function FeesAndDefaultsSection({
  defaultAllowances,
  defaultCopays,
  onChangeAllowances,
  onChangeCopays,
}: {
  defaultAllowances: DefaultAllowances;
  defaultCopays: DefaultCopays;
  onChangeAllowances: (value: DefaultAllowances) => void;
  onChangeCopays: (value: DefaultCopays) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Insurance Allowances &amp; Copays</CardTitle>
        <CardDescription>
          Pre-fills each new quote. Every value stays fully editable per patient in the Quote Builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Default allowances</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Frame allowance"
              valueCents={defaultAllowances.frameAllowanceCents}
              onChangeCents={(cents) => onChangeAllowances({ ...defaultAllowances, frameAllowanceCents: cents })}
            />
            <Field
              label="Lens allowance"
              valueCents={defaultAllowances.lensAllowanceCents}
              onChangeCents={(cents) => onChangeAllowances({ ...defaultAllowances, lensAllowanceCents: cents })}
            />
            <Field
              label="Additional credit"
              valueCents={defaultAllowances.additionalCreditCents}
              onChangeCents={(cents) => onChangeAllowances({ ...defaultAllowances, additionalCreditCents: cents })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Default copays</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label="Frame copay"
              valueCents={defaultCopays.frameCopayCents}
              onChangeCents={(cents) => onChangeCopays({ ...defaultCopays, frameCopayCents: cents })}
            />
            <Field
              label="Lens & material copay"
              valueCents={defaultCopays.lensCopayCents}
              onChangeCents={(cents) => onChangeCopays({ ...defaultCopays, lensCopayCents: cents })}
            />
            <Field
              label="Coating copay"
              valueCents={defaultCopays.coatingCopayCents}
              onChangeCents={(cents) => onChangeCopays({ ...defaultCopays, coatingCopayCents: cents })}
            />
            <Field
              label="Photochromic copay"
              valueCents={defaultCopays.photochromicCopayCents}
              onChangeCents={(cents) => onChangeCopays({ ...defaultCopays, photochromicCopayCents: cents })}
            />
            <Field
              label="Other copay"
              valueCents={defaultCopays.otherCopayCents}
              onChangeCents={(cents) => onChangeCopays({ ...defaultCopays, otherCopayCents: cents })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  valueCents,
  onChangeCents,
}: {
  label: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
}) {
  const id = `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <MoneyField id={id} valueCents={valueCents} onChangeCents={onChangeCents} />
    </div>
  );
}
