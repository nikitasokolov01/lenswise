"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EditableList } from "@/components/admin/EditableList";
import { generateId } from "@/lib/id";
import type { ProgressiveDesignConfig } from "@/lib/types";

export function ProgressiveDesignsSection({
  progressiveDesigns,
  onChange,
}: {
  progressiveDesigns: ProgressiveDesignConfig[];
  onChange: (items: ProgressiveDesignConfig[]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progressive Designs</CardTitle>
        <CardDescription>
          Only relevant when Lens Type is Progressive. Each design is an additional factor, alongside lens type
          and material, that determines the final lens price — set the actual prices in the Lens Materials
          section below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditableList
          items={progressiveDesigns}
          onChange={onChange}
          addLabel="Add progressive design"
          getName={(item) => item.name}
          getSubtitle={(item) => item.description}
          createNew={() => ({
            id: generateId("progressive-design"),
            name: "New Progressive Design",
            description: "",
            active: true,
            sortOrder: progressiveDesigns.length,
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
