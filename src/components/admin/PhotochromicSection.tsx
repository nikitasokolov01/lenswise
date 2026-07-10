"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MoneyField } from "@/components/ui/money-field";
import { CheckboxField } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import type { PhotochromicColorConfig, PhotochromicProductConfig } from "@/lib/types";

export function PhotochromicSection({
  products,
  colors,
  transitionsSurfacingFeeCents,
  onChangeProducts,
  onChangeColors,
  onChangeSurfacingFee,
}: {
  products: PhotochromicProductConfig[];
  colors: PhotochromicColorConfig[];
  transitionsSurfacingFeeCents: number;
  onChangeProducts: (items: PhotochromicProductConfig[]) => void;
  onChangeColors: (items: PhotochromicColorConfig[]) => void;
  onChangeSurfacingFee: (cents: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Photochromic Options</CardTitle>
        <CardDescription>Products, available Transitions Gen S colors, and the custom-color surfacing fee.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Products</h3>
          <EditableList
            items={products}
            onChange={onChangeProducts}
            addLabel="Add photochromic product"
            getName={(item) => item.name}
            getSubtitle={(item) => item.description}
            createNew={() => ({
              id: generateId("photo-product"),
              key: "house_gray" as const,
              name: "New Photochromic Product",
              description: "",
              retailPriceCents: 0,
              requiresColorSelection: false,
              active: true,
              sortOrder: products.length,
            })}
            renderFields={(item, update) => (
              <div className="space-y-3">
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
                  <div>
                    <Label htmlFor={`${item.id}-copay`}>
                      Insurance copay <span className="font-normal text-navy-400">(optional default)</span>
                    </Label>
                    <MoneyField
                      id={`${item.id}-copay`}
                      valueCents={item.insuranceCopayCents ?? 0}
                      onChangeCents={(cents) => update({ insuranceCopayCents: cents })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${item.id}-description`}>Description</Label>
                    <Input
                      id={`${item.id}-description`}
                      value={item.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                  </div>
                </div>
                <CheckboxField
                  label="Requires a color selection"
                  description="Turn this on for products like Transitions Gen S that offer multiple colors."
                  checked={item.requiresColorSelection}
                  onChange={(e) => update({ requiresColorSelection: e.target.checked })}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Transitions Gen S colors</h3>
          <EditableList
            items={colors}
            onChange={onChangeColors}
            addLabel="Add color"
            getName={(item) => item.name}
            getSubtitle={(item) => (item.isStandardColor ? "Standard color (no surfacing fee)" : "Custom color (surfacing fee applies)")}
            createNew={() => ({
              id: generateId("photo-color"),
              name: "New Color",
              isStandardColor: false,
              active: true,
              sortOrder: colors.length,
            })}
            renderFields={(item, update) => (
              <div className="space-y-3">
                <div>
                  <Label htmlFor={`${item.id}-name`}>Name</Label>
                  <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
                </div>
                <CheckboxField
                  label="Standard color (Gray / Brown style — exempt from the surfacing fee)"
                  description="Leave unchecked for custom colors like Sapphire, Amethyst, Amber, Emerald, Ruby, Graphite Green."
                  checked={item.isStandardColor}
                  onChange={(e) => update({ isStandardColor: e.target.checked })}
                />
              </div>
            )}
          />
        </div>

        <Separator />

        <div className="max-w-xs">
          <Label htmlFor="surfacing-fee">Transitions custom-color surfacing fee</Label>
          <MoneyField
            id="surfacing-fee"
            valueCents={transitionsSurfacingFeeCents}
            onChangeCents={onChangeSurfacingFee}
          />
          <p className="mt-1 text-xs text-navy-400">
            Automatically added when Lens Type is Single Vision, the product is Transitions Gen S, and the color is
            not marked as a standard color above.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
