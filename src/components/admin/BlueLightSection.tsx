"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import type { BlueLightOptionConfig } from "@/lib/types";

interface BlueLightSectionProps {
  options: BlueLightOptionConfig[];
  onChange: (items: BlueLightOptionConfig[]) => void;
}

/**
 * Blue Light options — an independent configurable lens option. Add / rename /
 * delete / reorder / enable-disable, and edit retail price (integer cents),
 * customer-facing label, and description.
 */
export function BlueLightSection({ options, onChange }: BlueLightSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blue Light</CardTitle>
        <CardDescription>
          Blue-light lens options offered in the Quote Builder — independent of coatings, photochromic, tint, and
          material.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={options}
          onChange={onChange}
          addLabel="Add blue light option"
          getName={(item) => item.name}
          getSubtitle={(item) => item.description}
          createNew={(): BlueLightOptionConfig => ({
            id: generateId("blue-light"),
            name: "New Option",
            customerLabel: "Blue Light Lens Option",
            description: "",
            retailPriceCents: 0,
            active: true,
            sortOrder: options.length,
          })}
          renderFields={(item, update) => (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${item.id}-name`}>Name (internal)</Label>
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
              <div>
                <Label htmlFor={`${item.id}-description`}>Description</Label>
                <Input
                  id={`${item.id}-description`}
                  value={item.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
              <div className="sm:max-w-xs">
                <Label htmlFor={`${item.id}-price`}>Retail price</Label>
                <MoneyField
                  id={`${item.id}-price`}
                  valueCents={item.retailPriceCents}
                  onChangeCents={(cents) => update({ retailPriceCents: cents })}
                />
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
