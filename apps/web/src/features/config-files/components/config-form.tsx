"use client";

import type { ConfigEdit } from "@wryte/logic/lib/config/edit";
import {
  blankLike,
  type ConfigObject,
  type ConfigPath,
  type ConfigValue,
  isConfigObject,
  isHexColor,
  itemLabel,
  OpaqueValue,
} from "@wryte/logic/lib/config/value";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Switch } from "@wryte/ui/switch";
import { Textarea } from "@wryte/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

type OnEdit = (edit: ConfigEdit) => void;

type NodeProps<Value> = {
  path: ConfigPath;
  value: Value;
  onEdit: OnEdit;
};

const DECIMAL_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;

function fieldId(path: ConfigPath): string {
  return `config-${path.map((key) => encodeURIComponent(key)).join("/")}`;
}

function isNested(value: ConfigValue): value is ConfigValue[] | ConfigObject {
  return Array.isArray(value) || isConfigObject(value);
}

export function ConfigForm({
  value,
  onEdit,
}: {
  value: ConfigValue;
  onEdit: OnEdit;
}) {
  if (Array.isArray(value)) {
    return <ListField name="items" path={[]} value={value} onEdit={onEdit} />;
  }
  if (isConfigObject(value)) {
    return <ObjectFields path={[]} value={value} onEdit={onEdit} />;
  }
  return (
    <p className="text-sm text-muted-foreground">
      This file holds a single value. Edit it in the code pane.
    </p>
  );
}

function ObjectFields({ path, value, onEdit }: NodeProps<ConfigObject>) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Empty object</p>;
  }
  return (
    <div className="space-y-2">
      {entries.map(([key, child]) => (
        <Field
          key={key}
          name={key}
          path={[...path, key]}
          value={child}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function Field({
  name,
  path,
  value,
  onEdit,
}: NodeProps<ConfigValue> & { name: string }) {
  if (Array.isArray(value)) {
    return <ListField name={name} path={path} value={value} onEdit={onEdit} />;
  }
  if (isConfigObject(value)) {
    return (
      <section className="pt-2">
        <h3 className="mb-2 font-mono text-xs font-medium">{name}</h3>
        <div className="border-l border-border pl-3">
          <ObjectFields path={path} value={value} onEdit={onEdit} />
        </div>
      </section>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-3">
      <label
        htmlFor={fieldId(path)}
        className="truncate pt-1.5 font-mono text-xs text-muted-foreground"
        title={name}
      >
        {name}
      </label>
      <ScalarControl path={path} value={value} onEdit={onEdit} />
    </div>
  );
}

function ScalarControl({ path, value, onEdit }: NodeProps<ConfigValue>) {
  const id = fieldId(path);
  if (typeof value === "string") {
    return (
      <StringControl
        id={id}
        value={value}
        onChange={(next) => onEdit({ kind: "set", path, value: next })}
      />
    );
  }
  if (typeof value === "number") {
    return (
      <NumberControl
        id={id}
        value={value}
        onChange={(next) => onEdit({ kind: "set", path, value: next })}
      />
    );
  }
  if (typeof value === "boolean") {
    return (
      <div className="flex h-8 items-center">
        <Switch
          id={id}
          checked={value}
          onCheckedChange={(next) => onEdit({ kind: "set", path, value: next })}
        />
      </div>
    );
  }
  return (
    <p
      id={id}
      className="flex h-8 items-center gap-2 font-mono text-xs text-muted-foreground"
    >
      <span>{value instanceof OpaqueValue ? value.text : "null"}</span>
      <span>edit in code</span>
    </p>
  );
}

function StringControl({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [multiline] = useState(() => value.includes("\n") || value.length > 80);
  if (multiline || value.includes("\n")) {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-8"
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      {isHexColor(value) && (
        <span
          aria-hidden="true"
          className="size-5 shrink-0 rounded-sm border border-border"
          style={{ backgroundColor: value }}
        />
      )}
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NumberControl({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      inputMode="decimal"
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (DECIMAL_NUMBER.test(next)) onChange(Number(next));
      }}
      className="max-w-40 font-mono"
    />
  );
}

function ListField({
  name,
  path,
  value,
  onEdit,
}: NodeProps<ConfigValue[]> & { name: string }) {
  const last = value[value.length - 1];
  const [openItems, setOpenItems] = useState(() =>
    value.map(() => value.length <= 3),
  );
  const reshape = (change: (items: boolean[]) => void) =>
    setOpenItems((current) => {
      const next = value.map((_, index) => current[index] ?? false);
      change(next);
      return next;
    });
  return (
    <section className="pt-2">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-xs font-medium">{name}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {value.length}
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          onClick={() => {
            reshape((items) => items.push(true));
            onEdit({
              kind: "insert",
              path,
              index: value.length,
              value: last === undefined ? "" : blankLike(last),
            });
          }}
        >
          <Plus />
          Add
        </Button>
      </div>
      <div className="space-y-1.5 border-l border-border pl-3">
        {value.map((item, index) => {
          const itemPath = [...path, index];
          const actions = (
            <ItemActions
              index={index}
              count={value.length}
              onMove={(to) => {
                reshape((items) =>
                  items.splice(to, 0, ...items.splice(index, 1)),
                );
                onEdit({ kind: "move", path, from: index, to });
              }}
              onRemove={() => {
                reshape((items) => items.splice(index, 1));
                onEdit({ kind: "remove", path: itemPath });
              }}
            />
          );
          if (!isNested(item)) {
            return (
              <div key={fieldId(itemPath)} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ScalarControl path={itemPath} value={item} onEdit={onEdit} />
                </div>
                {actions}
              </div>
            );
          }
          return (
            <NestedItem
              key={fieldId(itemPath)}
              path={itemPath}
              value={item}
              onEdit={onEdit}
              index={index}
              open={openItems[index] ?? false}
              onOpenChange={(open) =>
                reshape((items) => {
                  items[index] = open;
                })
              }
              actions={actions}
            />
          );
        })}
      </div>
    </section>
  );
}

function NestedItem({
  path,
  value,
  onEdit,
  index,
  open,
  onOpenChange,
  actions,
}: NodeProps<ConfigValue[] | ConfigObject> & {
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open) {
          onOpenChange(event.currentTarget.open);
        }
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 py-1 text-sm">
        <span className="font-mono text-xs text-muted-foreground">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {itemLabel(value, index)}
        </span>
        {actions}
      </summary>
      {open && (
        <div className="pb-2 pl-5 pt-1">
          {Array.isArray(value) ? (
            <ListField name="items" path={path} value={value} onEdit={onEdit} />
          ) : (
            <ObjectFields path={path} value={value} onEdit={onEdit} />
          )}
        </div>
      )}
    </details>
  );
}

function ItemActions({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Move up"
        disabled={index === 0}
        onClick={(event) => {
          event.preventDefault();
          onMove(index - 1);
        }}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={(event) => {
          event.preventDefault();
          onMove(index + 1);
        }}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove"
        onClick={(event) => {
          event.preventDefault();
          onRemove();
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
