"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { EditableList } from "@/components/admin/EditableList";
import { CoverageOverrideField } from "@/components/admin/CoverageOverrideField";
import { generateId } from "@/lib/id";
import type { CoatingConfig } from "@/lib/types";

export function CoatingsSection({
  coatings,
  onChange,
}: {
  coatings: CoatingConfig[];
  onChange: (items: CoatingConfig[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anti-Reflective Coatings</CardTitle>
        <CardDescription>No AR, Stock AR, SharpView, Crizal Rock, Crizal Sapphire, Crizal Prevencia.</CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={coatings}
          onChange={onChange}
          addLabel="Add coating"
          getName={(item) => item.name}
          getSubtitle={(item) => item.description}
          createNew={() => ({
            id: generateId("coating"),
            name: "New Coating",
            description: "",
            retailPriceCents: 0,
            active: true,
            sortOrder: coatings.length,
          })}
          renderFields={(item, update) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${item.id}-name`}>Name</Label>
                <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`${item.id}-retail`}>Retail price</Label>
                <MoneyField
                  id={`${item.id}-retail`}
                  valueCents={item.retailPriceCents}
                  onChangeCents={(cents) => update({ retailPriceCents: cents })}
                />
              </div>
              <CoverageOverrideField
                id={`${item.id}-coverage`}
                label="Insurance coverage (optional default override)"
                override={item.insuranceCoverage}
                onChange={(insuranceCoverage) => update({ insuranceCoverage })}
              />
              <div className="sm:col-span-2">
                <Label htmlFor={`${item.id}-description`}>Description</Label>
                <Input
                  id={`${item.id}-description`}
                  value={item.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
