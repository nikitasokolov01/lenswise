"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import type { LensTypeConfig } from "@/lib/types";

export function LensTypesSection({
  lensTypes,
  onChange,
}: {
  lensTypes: LensTypeConfig[];
  onChange: (items: LensTypeConfig[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lens Types</CardTitle>
        <CardDescription>
          Single Vision, Progressive, Bifocal, Lens Only, and Frame Only. A lens type only determines which
          pricing options are available — set actual prices per material in the Lens Materials section below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={lensTypes}
          onChange={onChange}
          addLabel="Add lens type"
          getName={(item) => item.name}
          getSubtitle={(item) => item.description}
          createNew={() => ({
            id: generateId("lens-type"),
            key: "single_vision" as const,
            name: "New Lens Type",
            description: "",
            active: true,
            sortOrder: lensTypes.length,
          })}
          renderFields={(item, update) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${item.id}-name`}>Name</Label>
                <Input id={`${item.id}-name`} value={item.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`${item.id}-description`}>Patient-facing description</Label>
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
