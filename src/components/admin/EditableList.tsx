"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

interface BaseItem {
  id: string;
  active: boolean;
  sortOrder: number;
}

interface EditableListProps<T extends BaseItem> {
  items: T[];
  onChange: (items: T[]) => void;
  createNew: () => T;
  getName: (item: T) => string;
  getSubtitle?: (item: T) => string | undefined;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel: string;
}

/**
 * Generic add / edit / disable / reorder list used by every Admin Pricing
 * section (lens types, materials, coatings, photochromic products, and
 * photochromic colors). Field-specific editing is delegated to the caller
 * via `renderFields` so this component stays shape-agnostic.
 */
export function EditableList<T extends BaseItem>({
  items,
  onChange,
  createNew,
  getName,
  getSubtitle,
  renderFields,
  addLabel,
}: EditableListProps<T>) {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function update(id: string, patch: Partial<T>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function moveItem(id: string, direction: -1 | 1) {
    const index = sorted.findIndex((item) => item.id === id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[swapIndex];
    onChange(
      items.map((item) => {
        if (item.id === a.id) return { ...item, sortOrder: b.sortOrder };
        if (item.id === b.id) return { ...item, sortOrder: a.sortOrder };
        return item;
      })
    );
  }

  function addItem() {
    const item = createNew();
    onChange([...items, item]);
    setExpandedId(item.id);
  }

  function deleteItem(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      onChange(items.filter((item) => item.id !== id));
      setExpandedId((current) => (current === id ? null : current));
    }
  }

  return (
    <div className="space-y-2.5">
      {sorted.map((item, index) => (
        <ListRow
          key={item.id}
          item={item}
          name={getName(item)}
          subtitle={getSubtitle?.(item)}
          isFirst={index === 0}
          isLast={index === sorted.length - 1}
          expanded={expandedId === item.id}
          onToggleExpanded={() => setExpandedId((current) => (current === item.id ? null : item.id))}
          onMoveUp={() => moveItem(item.id, -1)}
          onMoveDown={() => moveItem(item.id, 1)}
          onToggleActive={(active) => update(item.id, { active } as Partial<T>)}
          onDelete={() => deleteItem(item.id, getName(item))}
          renderFields={() => renderFields(item, (patch) => update(item.id, patch))}
        />
      ))}
      <Button variant="secondary" size="sm" onClick={addItem}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  );
}

function ListRow<T extends BaseItem>({
  item,
  name,
  subtitle,
  isFirst,
  isLast,
  expanded,
  onToggleExpanded,
  onMoveUp,
  onMoveDown,
  onToggleActive,
  onDelete,
  renderFields,
}: {
  item: T;
  name: string;
  subtitle?: string;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
  renderFields: () => ReactNode;
}) {
  const panelId = useId();
  return (
    <div className="rounded-md border border-navy-200">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col">
          <button
            type="button"
            aria-label={`Move ${name} up`}
            disabled={isFirst}
            onClick={onMoveUp}
            className="flex h-6 w-6 items-center justify-center rounded text-navy-400 hover:bg-navy-50 disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${name} down`}
            disabled={isLast}
            onClick={onMoveDown}
            className="flex h-6 w-6 items-center justify-center rounded text-navy-400 hover:bg-navy-50 disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-h-[44px] flex-1 items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-navy-900">
              {name} {!item.active ? <span className="ml-1 text-xs font-normal text-navy-400">(disabled)</span> : null}
            </span>
            {subtitle ? <span className="block text-xs text-navy-500">{subtitle}</span> : null}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-navy-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-navy-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {expanded ? (
        <div id={panelId} className="space-y-3 border-t border-navy-100 px-3 py-3">
          <CheckboxField
            label="Active (available to select in Quote Builder)"
            checked={item.active}
            onChange={(e) => onToggleActive(e.target.checked)}
          />
          {renderFields()}
        </div>
      ) : null}
    </div>
  );
}
